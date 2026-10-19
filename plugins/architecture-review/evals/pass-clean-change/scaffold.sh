#!/usr/bin/env bash
# Feature: a cancel-order use case that keeps every boundary
# (pure domain rule, use case on ports, thin route, wiring in the composition root).
set -euo pipefail
# shellcheck source=/dev/null  # shared fixture: ../_fixture/orders-repo.sh
source "$(dirname "${BASH_SOURCE[0]}")/../_fixture/orders-repo.sh"
base_repo

cat >> src/domain/order.ts <<'EOF'

export function cancel(order: Order): Order {
  if (order.status === 'cancelled') throw new Error(`order ${order.id} is already cancelled`);
  return { ...order, status: 'cancelled' };
}
EOF

write src/application/cancel-order.ts <<'EOF'
import { cancel, type Order, type OrderId } from '../domain/order.js';
import type { OrderRepository } from '../domain/ports.js';

export interface CancelOrderDeps {
  orders: OrderRepository;
}

export function makeCancelOrder(deps: CancelOrderDeps) {
  return async function cancelOrder(id: OrderId): Promise<Order | null> {
    const order = await deps.orders.findById(id);
    if (!order) return null;
    const cancelled = cancel(order);
    await deps.orders.save(cancelled);
    return cancelled;
  };
}
EOF

write src/http/orders-routes.ts <<'EOF'
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Order, OrderId, OrderLine } from '../domain/order.js';

const PlaceOrderBody = z.object({
  customerId: z.string().min(1),
  lines: z.array(z.object({
    sku: z.string().min(1),
    quantity: z.number().int().positive(),
    unitPriceCents: z.number().int().nonnegative(),
  })),
});

const OrderParams = z.object({ id: z.string().min(1) });

export interface OrdersRoutesDeps {
  placeOrder(customerId: string, lines: OrderLine[]): Promise<Order>;
  cancelOrder(id: OrderId): Promise<Order | null>;
}

export async function ordersRoutes(app: FastifyInstance, deps: OrdersRoutesDeps): Promise<void> {
  app.post('/orders', async (request, reply) => {
    const body = PlaceOrderBody.parse(request.body);
    const order = await deps.placeOrder(body.customerId, body.lines);
    return reply.code(201).send(order);
  });

  app.post('/orders/:id/cancel', async (request, reply) => {
    const { id } = OrderParams.parse(request.params);
    const order = await deps.cancelOrder(id);
    if (!order) return reply.code(404).send({ error: 'order not found' });
    return reply.send(order);
  });
}
EOF

write src/main.ts <<'EOF'
import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import pg from 'pg';
import { PgOrderRepository } from './adapters/pg-order-repository.js';
import { makeCancelOrder } from './application/cancel-order.js';
import { makePlaceOrder } from './application/place-order.js';
import { loadConfig } from './config/env.js';
import { ordersRoutes } from './http/orders-routes.js';

const config = loadConfig();
const pool = new pg.Pool({ connectionString: config.databaseUrl });
const orders = new PgOrderRepository(pool);

const placeOrder = makePlaceOrder({
  orders,
  clock: { now: () => new Date() },
  ids: { next: () => randomUUID() },
  maxItemsPerOrder: config.maxItemsPerOrder,
});
const cancelOrder = makeCancelOrder({ orders });

const app = Fastify();
await app.register(async (instance) => ordersRoutes(instance, { placeOrder, cancelOrder }));
await app.listen({ port: config.port });
EOF

commit_feature "orders: cancel an order"
