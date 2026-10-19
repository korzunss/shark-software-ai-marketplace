#!/usr/bin/env bash
# Feature: the place-order use case reads its limit from process.env
# instead of the injected config (env read outside the src/config/env.ts chokepoint).
set -euo pipefail
# shellcheck source=/dev/null  # shared fixture: ../_fixture/orders-repo.sh
source "$(dirname "${BASH_SOURCE[0]}")/../_fixture/orders-repo.sh"
base_repo

write src/application/place-order.ts <<'EOF'
import { assertValidLines, type Order, type OrderLine } from '../domain/order.js';
import type { Clock, IdGenerator, OrderRepository } from '../domain/ports.js';

export interface PlaceOrderDeps {
  orders: OrderRepository;
  clock: Clock;
  ids: IdGenerator;
}

export function makePlaceOrder(deps: PlaceOrderDeps) {
  return async function placeOrder(customerId: string, lines: OrderLine[]): Promise<Order> {
    const maxItems = Number(process.env.MAX_ITEMS_PER_ORDER ?? 50);
    assertValidLines(lines, maxItems);
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
});

const app = Fastify();
await app.register(async (instance) => ordersRoutes(instance, { placeOrder }));
await app.listen({ port: config.port });
EOF

commit_feature "place-order: read the line limit at call time"
