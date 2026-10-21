import { eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import {
  logisticsGroupCostLines,
  logisticsShipmentGroups,
  logisticsShipmentItems,
  logisticsShipments,
} from '@/database/schema';

import item75clEquivalents from './item75clEquivalents';
import itemBottles from './itemBottles';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Tolerance when comparing stored figures with a fresh allocation. */
const STALE_EPSILON = 0.005;

interface RecalcOptions {
  /**
   * Compute the allocation without writing anything, and report whether the
   * figures already on the items differ from it (`isStale`).
   */
  dryRun?: boolean;
  /**
   * Do nothing for a group that has never been allocated and holds no cost
   * lines — it does not own its shipments' landed cost yet, so a membership
   * change must not overwrite figures written by the shipment's own costing.
   */
  skipUnallocated?: boolean;
}

interface RecalcResult {
  /** True when the stored item figures no longer match this allocation. */
  isStale: boolean;
  totalProductCost: number;
  totalFreight: number;
  totalLanded: number;
  totalBottles: number;
  totalCases: number;
  perBottleFreight: number;
}

/**
 * Re-allocate a shipment group's logistics cost ledger across every bottle and
 * write the landed cost per bottle onto each item, plus the member-shipment and
 * group headers. Shared cost lines spread across all bottles in the group;
 * per-shipment lines spread only within their own shipment. Freight is split by
 * 75cl-equivalent so magnums carry their fair share.
 *
 * Idempotent and safe to call after any cost-line change — it runs even with an
 * empty cost ledger (freight falls to 0, so removing a cost lowers landed cost).
 * Returns `null` when there is nothing to allocate yet (no group / no shipments /
 * no items) so best-effort callers can ignore it.
 *
 * With `dryRun` the same allocation is computed but nothing is written; the
 * result's `isStale` says whether the stored item figures differ from it, so
 * the group page can flag a recalculation that failed or inputs that changed.
 *
 * @example
 *   await recalcGroupLandedCost(groupId); // writes landedCostPerBottle onto every item
 *   const check = await recalcGroupLandedCost(groupId, { dryRun: true });
 *
 * @param groupId - The shipment group to re-allocate
 * @param options - `dryRun` to compare only; `skipUnallocated` to leave a
 *   never-allocated group with no cost lines untouched
 * @returns The allocation totals, or null when there is nothing to allocate
 */
const recalcGroupLandedCost = async (
  groupId: string,
  options: RecalcOptions = {},
): Promise<RecalcResult | null> => {
  const { dryRun = false, skipUnallocated = false } = options;

  const [group] = await db
    .select()
    .from(logisticsShipmentGroups)
    .where(eq(logisticsShipmentGroups.id, groupId));

  if (!group) return null;

  const shipments = await db
    .select()
    .from(logisticsShipments)
    .where(eq(logisticsShipments.groupId, group.id));

  if (shipments.length === 0) return null;

  const shipmentIds = shipments.map((s) => s.id);
  const items = await db
    .select()
    .from(logisticsShipmentItems)
    .where(inArray(logisticsShipmentItems.shipmentId, shipmentIds));

  if (items.length === 0) return null;

  const costLines = await db
    .select()
    .from(logisticsGroupCostLines)
    .where(eq(logisticsGroupCostLines.groupId, group.id));

  if (skipUnallocated && costLines.length === 0 && !group.allocatedAt) {
    return null;
  }

  const sharedUsd = costLines
    .filter((l) => l.scope === 'shared')
    .reduce((s, l) => s + l.amountUsd, 0);
  const directByShipment = new Map<string, number>();
  for (const l of costLines) {
    if (l.scope === 'shipment' && l.shipmentId) {
      directByShipment.set(
        l.shipmentId,
        (directByShipment.get(l.shipmentId) ?? 0) + l.amountUsd,
      );
    }
  }

  const totalBottles = items.reduce((s, i) => s + itemBottles(i), 0);
  const totalEquiv = items.reduce((s, i) => s + item75clEquivalents(i), 0);
  const equivByShipment = new Map<string, number>();
  for (const i of items) {
    equivByShipment.set(
      i.shipmentId,
      (equivByShipment.get(i.shipmentId) ?? 0) + item75clEquivalents(i),
    );
  }

  let totalProductCost = 0;
  let totalFreight = 0;
  let isStale = false;
  const landedByShipment = new Map<string, number>();

  for (const item of items) {
    const bottles = itemBottles(item);
    const equiv = item75clEquivalents(item);
    const productCost = bottles * (item.productCostPerBottle ?? 0);
    const sharedShare = totalEquiv > 0 ? sharedUsd * (equiv / totalEquiv) : 0;
    const shipEquiv = equivByShipment.get(item.shipmentId) ?? 0;
    const directShare =
      shipEquiv > 0
        ? (directByShipment.get(item.shipmentId) ?? 0) * (equiv / shipEquiv)
        : 0;
    const freight = sharedShare + directShare;
    const landedTotal = productCost + freight;

    totalProductCost += productCost;
    totalFreight += freight;
    landedByShipment.set(
      item.shipmentId,
      (landedByShipment.get(item.shipmentId) ?? 0) + landedTotal,
    );

    const next = {
      freightAllocated: round2(freight),
      landedCostTotal: round2(landedTotal),
      landedCostPerBottle: bottles > 0 ? round2(landedTotal / bottles) : 0,
    };

    if (dryRun) {
      const differs = (stored: number | null, fresh: number) =>
        stored == null || Math.abs(stored - fresh) > STALE_EPSILON;
      if (
        differs(item.freightAllocated, next.freightAllocated) ||
        differs(item.landedCostTotal, next.landedCostTotal) ||
        differs(item.landedCostPerBottle, next.landedCostPerBottle)
      ) {
        isStale = true;
      }
      continue;
    }

    await db
      .update(logisticsShipmentItems)
      .set({ ...next, updatedAt: new Date() })
      .where(eq(logisticsShipmentItems.id, item.id));
  }

  const totalCases = items.reduce((s, i) => s + (i.cases ?? 0), 0);
  const totals = {
    totalProductCost: round2(totalProductCost),
    totalFreight: round2(totalFreight),
    totalLanded: round2(totalProductCost + totalFreight),
    totalBottles,
    totalCases,
    perBottleFreight: totalBottles > 0 ? round2(totalFreight / totalBottles) : 0,
  };

  if (dryRun) return { isStale, ...totals };

  // Keep each member shipment's header landed cost in step with its share.
  for (const shipment of shipments) {
    await db
      .update(logisticsShipments)
      .set({
        totalLandedCostUsd: round2(landedByShipment.get(shipment.id) ?? 0),
        updatedAt: new Date(),
      })
      .where(eq(logisticsShipments.id, shipment.id));
  }

  await db
    .update(logisticsShipmentGroups)
    .set({
      totalLandedCostUsd: round2(totalProductCost + totalFreight),
      totalBottles,
      totalCases,
      allocatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(logisticsShipmentGroups.id, group.id));

  return { isStale: false, ...totals };
};

export default recalcGroupLandedCost;
