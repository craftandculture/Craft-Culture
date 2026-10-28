import { eq } from 'drizzle-orm';

import db from '@/database/client';
import {
  logisticsGroupCostLines,
  logisticsShipmentCostLines,
  logisticsShipmentGroups,
  logisticsShipmentItems,
  logisticsShipments,
} from '@/database/schema';

import calculateLandedCost from './calculateLandedCost';

const round2 = (n: number) => Math.round(n * 100) / 100;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Recompute a shipment's 8 cost fields as the sum of its cost-ledger lines by
 * category, then re-run landed-cost allocation. Call after any ledger change so
 * the breakdown, per-item landed cost and pricing stay in sync with the ledger.
 *
 * A shipment in a consolidation group whose freight has been allocated (the
 * group has cost lines or an allocation date) takes its landed cost from the
 * group: the breakdown fields are still updated, but the items' landed cost is
 * left as the group allocation wrote it rather than overwritten.
 *
 * @param shipmentId - The shipment whose ledger changed
 * @param conn - A transaction to run inside, or the database
 * @returns Whether the landed cost was left to the shipment's group
 */
const syncShipmentCostsFromLedger = async (shipmentId: string, conn: Tx | typeof db = db) => {
  const lines = await conn
    .select()
    .from(logisticsShipmentCostLines)
    .where(eq(logisticsShipmentCostLines.shipmentId, shipmentId));

  const b = {
    freight: 0,
    insurance: 0,
    origin_handling: 0,
    destination_handling: 0,
    customs: 0,
    gov_fees: 0,
    delivery: 0,
    other: 0,
  };
  type BKey = keyof typeof b;
  for (const l of lines) {
    // Transportation is road haulage to or from the warehouse: the delivery bucket
    const category = l.category === 'transportation' ? 'delivery' : l.category;
    const k: BKey = category in b ? (category as BKey) : 'other';
    b[k] += l.amountUsd;
  }

  await conn
    .update(logisticsShipments)
    .set({
      freightCostUsd: round2(b.freight),
      insuranceCostUsd: round2(b.insurance),
      originHandlingUsd: round2(b.origin_handling),
      destinationHandlingUsd: round2(b.destination_handling),
      customsClearanceUsd: round2(b.customs),
      govFeesUsd: round2(b.gov_fees),
      deliveryCostUsd: round2(b.delivery),
      otherCostsUsd: round2(b.other),
      updatedAt: new Date(),
    })
    .where(eq(logisticsShipments.id, shipmentId));

  const [shipment] = await conn
    .select()
    .from(logisticsShipments)
    .where(eq(logisticsShipments.id, shipmentId));

  if (shipment?.groupId) {
    const [group] = await conn
      .select({ allocatedAt: logisticsShipmentGroups.allocatedAt })
      .from(logisticsShipmentGroups)
      .where(eq(logisticsShipmentGroups.id, shipment.groupId));
    const [groupLine] = await conn
      .select({ id: logisticsGroupCostLines.id })
      .from(logisticsGroupCostLines)
      .where(eq(logisticsGroupCostLines.groupId, shipment.groupId))
      .limit(1);

    if (group && (group.allocatedAt || groupLine)) {
      return { deferredToGroup: true };
    }
  }

  const items = await conn
    .select()
    .from(logisticsShipmentItems)
    .where(eq(logisticsShipmentItems.shipmentId, shipmentId));

  if (shipment && items.length > 0) {
    const result = calculateLandedCost(shipment, items);
    await conn
      .update(logisticsShipments)
      .set({ totalLandedCostUsd: result.totalLandedCost, updatedAt: new Date() })
      .where(eq(logisticsShipments.id, shipmentId));
    for (const it of result.items) {
      await conn
        .update(logisticsShipmentItems)
        .set({
          freightAllocated: it.freightAllocated,
          landedCostTotal: it.landedCostTotal,
          landedCostPerBottle: it.landedCostPerBottle,
          updatedAt: new Date(),
        })
        .where(eq(logisticsShipmentItems.id, it.itemId));
    }
  }

  return { deferredToGroup: false };
};

export default syncShipmentCostsFromLedger;
