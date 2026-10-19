#!/usr/bin/env bash
# Feature: the Postgres adapter builds its lookup query by string interpolation.
# That is SQL injection (a security finding), but every import and file stays
# in its layer, so the architecture review must not report it as a finding.
set -euo pipefail
# shellcheck source=/dev/null  # shared fixture: ../_fixture/orders-repo.sh
source "$(dirname "${BASH_SOURCE[0]}")/../_fixture/orders-repo.sh"
base_repo

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
    const res = await this.pool.query(`SELECT * FROM orders WHERE id = '${id}' LIMIT 1`);
    const r = res.rows[0];
    if (!r) return null;
    return {
      id: r.id,
      customerId: r.customer_id,
      lines: r.lines,
      status: r.status,
      createdAt: r.created_at,
    };
  }
}
EOF

commit_feature "pg-order-repository: simplify the lookup query"
