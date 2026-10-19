#!/usr/bin/env bash
# Feature: the domain core loads a discount table from disk with node:fs (I/O in the pure core).
set -euo pipefail
# shellcheck source=/dev/null  # shared fixture: ../_fixture/orders-repo.sh
source "$(dirname "${BASH_SOURCE[0]}")/../_fixture/orders-repo.sh"
base_repo

write src/domain/order.ts <<'EOF'
import { readFileSync } from 'node:fs';

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

function loadDiscounts(): Record<string, number> {
  return JSON.parse(readFileSync('config/discounts.json', 'utf8')) as Record<string, number>;
}

export function orderTotalCents(order: Order): number {
  const discounts = loadDiscounts();
  return order.lines.reduce((sum, line) => {
    const percentOff = discounts[line.sku] ?? 0;
    return sum + Math.round(line.quantity * line.unitPriceCents * (1 - percentOff / 100));
  }, 0);
}

export function assertValidLines(lines: OrderLine[], maxItems: number): void {
  if (lines.length === 0) throw new Error('an order needs at least one line');
  if (lines.length > maxItems) throw new Error(`an order has at most ${maxItems} lines`);
  for (const line of lines) {
    if (line.quantity <= 0) throw new Error(`quantity must be positive for ${line.sku}`);
  }
}
EOF

write config/discounts.json <<'EOF'
{ "SKU-SUMMER": 10 }
EOF

commit_feature "order: apply per-SKU discounts to the total"
