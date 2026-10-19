#!/usr/bin/env bash
# Shared fixture for the architecture-review eval cases (sourced by each case's scaffold.sh).
# Builds a small onion-style TypeScript service in the current directory:
#   main  — a clean baseline commit
#   feature — checked out; each case adds its own commit on top with `commit_feature`.
# Not a case directory: it has no prompt.md or case.yaml.
set -euo pipefail

git_q() {
  git -c user.name="Eval Fixture" -c user.email="eval@example.invalid" \
      -c init.defaultBranch=main -c commit.gpgsign=false "$@"
}

write() { # write <path>  (content on stdin)
  mkdir -p "$(dirname "$1")"
  cat > "$1"
}

base_repo() {
  git_q init --quiet

  write package.json <<'EOF'
{
  "name": "orders-service",
  "private": true,
  "type": "module",
  "dependencies": { "fastify": "^5.0.0", "pg": "^8.13.0", "zod": "^3.24.0" }
}
EOF

  write AGENTS.md <<'EOF'
# orders-service

A small orders API. Backend only, onion architecture.

## Where code lives

| Layer | Path | May import |
|---|---|---|
| Domain (pure core) | `src/domain/` | nothing outside `src/domain/` |
| Application (use cases) | `src/application/` | `src/domain/` (entities and ports) |
| Adapters (infrastructure) | `src/adapters/` | `src/domain/`, drivers (`pg`) |
| Transport (HTTP) | `src/http/` | `src/application/`, `src/domain/`, `zod`, `fastify` |
| Composition root | `src/main.ts` | everything; the only place adapters are constructed |

- Ports (interfaces) are defined in `src/domain/ports.ts`.
- **Env chokepoint:** `src/config/env.ts` is the only file that reads `process.env`.
  Everything else receives configuration as constructor or function arguments.
EOF

  write src/domain/order.ts <<'EOF'
export type OrderId = string;

export interface OrderLine {
  sku: string;
  quantity: number;
  unitPriceCents: number;
}

export interface Order {
  id: OrderId;
  customerId: string;
  lines: OrderLine[];
  status: 'placed' | 'cancelled';
  createdAt: Date;
}

export function orderTotalCents(order: Order): number {
  return order.lines.reduce((sum, line) => sum + line.quantity * line.unitPriceCents, 0);
}

export function assertValidLines(lines: OrderLine[], maxItems: number): void {
  if (lines.length === 0) throw new Error('an order needs at least one line');
  if (lines.length > maxItems) throw new Error(`an order has at most ${maxItems} lines`);
  for (const line of lines) {
    if (line.quantity <= 0) throw new Error(`quantity must be positive for ${line.sku}`);
  }
}
EOF

  write src/domain/ports.ts <<'EOF'
import type { Order, OrderId } from './order.js';

export interface OrderRepository {
  save(order: Order): Promise<void>;
  findById(id: OrderId): Promise<Order | null>;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}
EOF

  write src/application/place-order.ts <<'EOF'
import { assertValidLines, type Order, type OrderLine } from '../domain/order.js';
import type { Clock, IdGenerator, OrderRepository } from '../domain/ports.js';

export interface PlaceOrderDeps {
  orders: OrderRepository;
  clock: Clock;
  ids: IdGenerator;
  maxItemsPerOrder: number;
}

export function makePlaceOrder(deps: PlaceOrderDeps) {
  return async function placeOrder(customerId: string, lines: OrderLine[]): Promise<Order> {
    assertValidLines(lines, deps.maxItemsPerOrder);
    const order: Order = {
      id: deps.ids.next(),
      customerId,
      lines,
      status: 'placed',
      createdAt: deps.clock.now(),
    };
    await deps.orders.save(order);
    return order;
  };
}
EOF

  write src/adapters/pg-order-repository.ts <<'EOF'
import type { Pool } from 'pg';
import type { Order, OrderId } from '../domain/order.js';
import type { OrderRepository } from '../domain/ports.js';

export class PgOrderRepository implements OrderRepository {
  constructor(private readonly pool: Pool) {}

  async save(order: Order): Promise<void> {
    await this.pool.query(
      'INSERT INTO orders (id, customer_id, lines, status, created_at) VALUES ($1, $2, $3, $4, $5)',
      [order.id, order.customerId, JSON.stringify(order.lines), order.status, order.createdAt],
    );
  }

  async findById(id: OrderId): Promise<Order | null> {
    const { rows } = await this.pool.query('SELECT * FROM orders WHERE id = $1', [id]);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      customerId: row.customer_id,
      lines: row.lines,
      status: row.status,
      createdAt: row.created_at,
    };
  }
}
EOF

  write src/http/orders-routes.ts <<'EOF'
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Order, OrderLine } from '../domain/order.js';

const PlaceOrderBody = z.object({
  customerId: z.string().min(1),
  lines: z.array(z.object({
    sku: z.string().min(1),
    quantity: z.number().int().positive(),
    unitPriceCents: z.number().int().nonnegative(),
  })),
});

export interface OrdersRoutesDeps {
  placeOrder(customerId: string, lines: OrderLine[]): Promise<Order>;
}

export async function ordersRoutes(app: FastifyInstance, deps: OrdersRoutesDeps): Promise<void> {
  app.post('/orders', async (request, reply) => {
    const body = PlaceOrderBody.parse(request.body);
    const order = await deps.placeOrder(body.customerId, body.lines);
    return reply.code(201).send(order);
  });
}
EOF

  write src/config/env.ts <<'EOF'
export interface AppConfig {
  databaseUrl: string;
  port: number;
  maxItemsPerOrder: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  return {
    databaseUrl,
    port: Number(env.PORT ?? 3000),
    maxItemsPerOrder: Number(env.MAX_ITEMS_PER_ORDER ?? 50),
  };
}
EOF

  write src/main.ts <<'EOF'
import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import pg from 'pg';
import { PgOrderRepository } from './adapters/pg-order-repository.js';
import { makePlaceOrder } from './application/place-order.js';
import { loadConfig } from './config/env.js';
import { ordersRoutes } from './http/orders-routes.js';

const config = loadConfig();
const pool = new pg.Pool({ connectionString: config.databaseUrl });

const placeOrder = makePlaceOrder({
  orders: new PgOrderRepository(pool),
  clock: { now: () => new Date() },
  ids: { next: () => randomUUID() },
  maxItemsPerOrder: config.maxItemsPerOrder,
});

const app = Fastify();
await app.register(async (instance) => ordersRoutes(instance, { placeOrder }));
await app.listen({ port: config.port });
EOF

  git_q add -A
  git_q commit --quiet -m "orders-service: place an order"
  git_q checkout --quiet -b feature
}

commit_feature() { # commit_feature <message>
  git_q add -A
  git_q commit --quiet -m "$1"
}
