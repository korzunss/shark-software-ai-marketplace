#!/usr/bin/env bash
# Feature: the place-order use case builds its own Postgres repository
# instead of receiving the OrderRepository port (application → adapter import).
set -euo pipefail
# shellcheck source=/dev/null  # shared fixture: ../_fixture/orders-repo.sh
source "$(dirname "${BASH_SOURCE[0]}")/../_fixture/orders-repo.sh"
base_repo

write src/application/place-order.ts <<'EOF'
import pg from 'pg';
import { PgOrderRepository } from '../adapters/pg-order-repository.js';
import { assertValidLines, type Order, type OrderLine } from '../domain/order.js';
import type { Clock, IdGenerator } from '../domain/ports.js';

export interface PlaceOrderDeps {
  databaseUrl: string;
  clock: Clock;
  ids: IdGenerator;
  maxItemsPerOrder: number;
}

export function makePlaceOrder(deps: PlaceOrderDeps) {
  const orders = new PgOrderRepository(new pg.Pool({ connectionString: deps.databaseUrl }));
  return async function placeOrder(customerId: string, lines: OrderLine[]): Promise<Order> {
    assertValidLines(lines, deps.maxItemsPerOrder);
    const order: Order = {
      id: deps.ids.next(),
      customerId,
      lines,
      status: 'placed',
      createdAt: deps.clock.now(),
    };
    await orders.save(order);
    return order;
  };
}
EOF

write src/main.ts <<'EOF'
import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import { makePlaceOrder } from './application/place-order.js';
import { loadConfig } from './config/env.js';
import { ordersRoutes } from './http/orders-routes.js';

const config = loadConfig();

const placeOrder = makePlaceOrder({
  databaseUrl: config.databaseUrl,
  clock: { now: () => new Date() },
  ids: { next: () => randomUUID() },
  maxItemsPerOrder: config.maxItemsPerOrder,
});

const app = Fastify();
await app.register(async (instance) => ordersRoutes(instance, { placeOrder }));
await app.listen({ port: config.port });
EOF

commit_feature "place-order: open the database connection in the use case"
