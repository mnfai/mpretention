import type { MatchTier, Platform } from "./types";

export interface IdentityFields {
  buyer_username: string | null;
  phone: string | null;
  recipient: string | null;
  province: string | null;
  regency_city: string | null;
}

export interface CustomerKeyResult {
  customer_key: string;
  tier_used: MatchTier;
}

/** Row shape needed to resolve a single transaction's customer identity. */
export interface ResolvableRow extends IdentityFields {
  order_id: string;
  created_at: string;
}

/** Minimal shape of a customer already in the DB, for in-memory matching. */
export interface ExistingCustomer {
  id: number;
  customer_key: string;
}

/** A brand-new customer row to be inserted, keyed by its canonical customer_key. */
export interface NewCustomerRecord extends IdentityFields {
  customer_key: string;
  match_tier: MatchTier;
  first_order_id: string;
  first_purchase_date: string;
  total_orders: number;
}

export interface ResolvedRow {
  customer_key: string;
  tier_used: MatchTier;
  is_retention: 0 | 1;
}

export interface ResolveBatchResult {
  /** Same order and length as the input rows. */
  resolved: ResolvedRow[];
  /** New customer rows to insert, in first-seen (chronological) order. */
  newCustomers: NewCustomerRecord[];
  /** customer.id -> number of additional orders to add to total_orders. */
  existingIncrements: Map<number, number>;
}

/**
 * Builds the canonical customer_key + match tier for one row (PRD §3).
 *
 * Shopee rows only ever carry `buyer_username` (Tier 1). TikTok falls
 * through Tier 1 (username) -> Tier 2 (phone) -> Tier 3 (recipient +
 * province + regency/city). Tier 4 (no match) keys on the order id and is
 * never retention.
 */
export function buildCustomerKey(
  platform: Platform,
  orderId: string,
  fields: IdentityFields,
): CustomerKeyResult {
  if (fields.buyer_username) {
    return { customer_key: fields.buyer_username, tier_used: 1 };
  }
  if (platform === "TikTokShop") {
    if (fields.phone) {
      return { customer_key: fields.phone, tier_used: 2 };
    }
    if (fields.recipient && fields.province && fields.regency_city) {
      return {
        customer_key: `${fields.recipient}|${fields.province}|${fields.regency_city}`,
        tier_used: 3,
      };
    }
  }
  return { customer_key: `UNKNOWN_${orderId}`, tier_used: null };
}

/**
 * Resolves customer identity and `is_retention` for a batch of rows that all
 * share one brand + platform.
 *
 * Rows are grouped by `order_id` first (a multi-SKU order produces one row
 * per line item, but is a single order for retention purposes), then groups
 * are processed in chronological order (by `created_at`) regardless of input
 * order, so the first purchase is correctly identified even if the batch
 * isn't pre-sorted. Every row in an order group gets the same customer_key /
 * tier_used / is_retention. `resolved` is returned in the same order as
 * `rows`. `existing` must be every customer already in the DB for this
 * brand + platform, loaded once by the caller.
 */
export function resolveCustomerBatch(
  rows: ReadonlyArray<ResolvableRow>,
  platform: Platform,
  existing: ReadonlyArray<ExistingCustomer>,
): ResolveBatchResult {
  const resolved: ResolvedRow[] = new Array(rows.length);
  const existingByKey = new Map(existing.map((c) => [c.customer_key, c]));
  const newByKey = new Map<string, NewCustomerRecord>();
  const existingIncrements = new Map<number, number>();

  const orderGroups = new Map<string, number[]>();
  for (let i = 0; i < rows.length; i++) {
    const group = orderGroups.get(rows[i].order_id);
    if (group) group.push(i);
    else orderGroups.set(rows[i].order_id, [i]);
  }

  const orderIds = [...orderGroups.keys()].sort((a, b) => {
    const ia = orderGroups.get(a)![0];
    const ib = orderGroups.get(b)![0];
    const cmp = rows[ia].created_at.localeCompare(rows[ib].created_at);
    return cmp !== 0 ? cmp : ia - ib;
  });

  for (const orderId of orderIds) {
    const indices = orderGroups.get(orderId)!;
    const row = rows[indices[0]];
    const { customer_key, tier_used } = buildCustomerKey(platform, row.order_id, row);
    let is_retention: 0 | 1;

    if (tier_used === null) {
      // Tier 4: every "customer" is unique to its own order and never retention.
      const existingNew = newByKey.get(customer_key);
      if (existingNew) {
        existingNew.total_orders += 1;
      } else {
        newByKey.set(customer_key, {
          customer_key,
          match_tier: null,
          buyer_username: row.buyer_username,
          phone: row.phone,
          recipient: row.recipient,
          province: row.province,
          regency_city: row.regency_city,
          first_order_id: row.order_id,
          first_purchase_date: row.created_at,
          total_orders: 1,
        });
      }
      is_retention = 0;
    } else {
      const existingMatch = existingByKey.get(customer_key);
      const newMatch = newByKey.get(customer_key);

      if (existingMatch) {
        existingIncrements.set(existingMatch.id, (existingIncrements.get(existingMatch.id) ?? 0) + 1);
        is_retention = 1;
      } else if (newMatch) {
        newMatch.total_orders += 1;
        is_retention = 1;
      } else {
        newByKey.set(customer_key, {
          customer_key,
          match_tier: tier_used,
          buyer_username: row.buyer_username,
          phone: row.phone,
          recipient: row.recipient,
          province: row.province,
          regency_city: row.regency_city,
          first_order_id: row.order_id,
          first_purchase_date: row.created_at,
          total_orders: 1,
        });
        is_retention = 0;
      }
    }

    for (const i of indices) {
      resolved[i] = { customer_key, tier_used, is_retention };
    }
  }

  return { resolved, newCustomers: [...newByKey.values()], existingIncrements };
}
