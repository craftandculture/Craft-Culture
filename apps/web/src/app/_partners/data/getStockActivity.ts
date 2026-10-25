import { and, desc, eq, inArray } from 'drizzle-orm';

import getOwnerDeliveryOwners from '@/app/_cellar/data/getOwnerDeliveryOwners';
import STOCK_OUT_REASONS from '@/app/_wms/constants/stockOutReasons';
import partnerMovementScope from '@/app/_wms/utils/partnerMovementScope';
import db from '@/database/client';
import {
  privateClientOrders,
  wmsLocations,
  wmsStockMovements,
  zohoSalesOrders,
} from '@/database/schema';

import type { PartnerActivityEntry } from '../controllers/partnerGetActivity';

/** Stock movements in an owner's words, and the kind each one is */
const STOCK_EVENTS: Record<string, { title: string; kind: PartnerActivityEntry['kind'] }> = {
  receive: { title: 'Received', kind: 'in' },
  putaway: { title: 'Put away', kind: 'internal' },
  transfer: { title: 'Moved bay', kind: 'internal' },
  pick: { title: 'Picked for an order', kind: 'out' },
  repack_in: { title: 'Repacked', kind: 'internal' },
  repack_out: { title: 'Repacked', kind: 'internal' },
  adjust: { title: 'Stock corrected', kind: 'correction' },
  count: { title: 'Stock count correction', kind: 'correction' },
  dispatch: { title: 'Dispatched', kind: 'out' },
  ownership_transfer: { title: 'Ownership changed', kind: 'correction' },
};

/** Bottles a movement moved: its own count when recorded, else cases × pack */
const bottlesOf = (lwin18: string, cases: number, bottles: number | null) =>
  Math.abs(bottles ?? cases * (Number(lwin18.split('-')[2]) || 1));

/**
 * A movement's quantity in words
 *
 * The pack is the third segment of the code. Single-bottle stock is counted
 * in bottles — "2 cs · 2 btl" for two loose bottles read as two cases. A
 * count correction keeps its sign, so a removal reads as one.
 */
const quantityOf = (lwin18: string, cases: number, bottles: number | null) => {
  const pack = Number(lwin18.split('-')[2]) || 0;
  const plural = (n: number, word: string) => `${n} ${word}${Math.abs(n) === 1 ? '' : 's'}`;
  const sign = cases < 0 ? '−' : '';
  const n = Math.abs(cases);

  if (pack === 1) return `${sign}${plural(n || Math.abs(bottles ?? 0), 'bottle')}`;
  if (n === 0 && bottles) return plural(Math.abs(bottles), 'bottle');
  if (n === 0) return null;
  return `${sign}${plural(n, 'case')}${bottles && bottles !== n ? ` · ${Math.abs(bottles)} btl` : ''}`;
};

/**
 * Everything that has happened to one owner's stock, newest first
 *
 * Shared by the wine partner and Private Cellar activity feeds, so both read
 * the same events the same way. A bottle leaving says what became of it:
 * the owner's own delivery, a sale, a sample taken by C&C, damage in our
 * care. Who bought it is named only to a Private Cellar member; a trade
 * partner is never told the counterparty. Warehouse handling (bay moves,
 * put-away, repacks) is returned as `internal` for the feed to fold away.
 *
 * @example
 *   const entries = await getStockActivity({ partnerId, isCollector: true, limit: 60 });
 *
 * @param input.partnerId - The owner
 * @param input.isCollector - A Private Cellar member, who may see buyer names
 * @param input.limit - How many movements
 * @returns Activity entries in the shared feed shape
 */
const getStockActivity = async ({
  partnerId,
  isCollector,
  limit,
}: {
  partnerId: string;
  isCollector: boolean;
  limit: number;
}): Promise<PartnerActivityEntry[]> => {
  const scope = await partnerMovementScope(partnerId);
  if (scope.ownedLwins.length === 0) return [];

  const fromLocation = db
    .select({ id: wmsLocations.id, code: wmsLocations.locationCode })
    .from(wmsLocations)
    .as('from_location');
  const toLocation = db
    .select({ id: wmsLocations.id, code: wmsLocations.locationCode })
    .from(wmsLocations)
    .as('to_location');

  const rows = await db
    .select({
      id: wmsStockMovements.id,
      movementNumber: wmsStockMovements.movementNumber,
      movementType: wmsStockMovements.movementType,
      reasonCode: wmsStockMovements.reasonCode,
      lwin18: wmsStockMovements.lwin18,
      productName: wmsStockMovements.productName,
      quantityCases: wmsStockMovements.quantityCases,
      quantityBottles: wmsStockMovements.quantityBottles,
      fromOwnerId: wmsStockMovements.fromOwnerId,
      toOwnerId: wmsStockMovements.toOwnerId,
      orderId: wmsStockMovements.orderId,
      fromLocation: fromLocation.code,
      toLocation: toLocation.code,
      performedAt: wmsStockMovements.performedAt,
      // A pick records the order it was for; that is a PCO or a Zoho SO
      pcoNumber: privateClientOrders.orderNumber,
      salesOrderNumber: zohoSalesOrders.salesOrderNumber,
      customerName: zohoSalesOrders.customerName,
    })
    .from(wmsStockMovements)
    .leftJoin(privateClientOrders, eq(wmsStockMovements.orderId, privateClientOrders.id))
    .leftJoin(zohoSalesOrders, eq(wmsStockMovements.orderId, zohoSalesOrders.id))
    .leftJoin(fromLocation, eq(wmsStockMovements.fromLocationId, fromLocation.id))
    .leftJoin(toLocation, eq(wmsStockMovements.toLocationId, toLocation.id))
    .where(
      and(
        scope.condition,
        inArray(wmsStockMovements.movementType, [
          'receive',
          'putaway',
          'transfer',
          'pick',
          'repack_in',
          'repack_out',
          'adjust',
          'count',
          'dispatch',
          'ownership_transfer',
        ]),
      ),
    )
    .orderBy(desc(wmsStockMovements.performedAt))
    .limit(limit);

  const deliveries = await getOwnerDeliveryOwners(rows.map((row) => row.orderId));

  /** What happened, in the owner's words */
  const describe = (row: (typeof rows)[number]) => {
    const base = STOCK_EVENTS[row.movementType] ?? { title: row.movementType, kind: 'internal' as const };

    if (row.reasonCode?.startsWith('stock_out:')) {
      const reason = row.reasonCode.slice('stock_out:'.length) as keyof typeof STOCK_OUT_REASONS;
      return { title: STOCK_OUT_REASONS[reason]?.ownerSees ?? 'Taken out of stock', kind: 'out' as const };
    }
    if (row.movementType === 'ownership_transfer') {
      return row.toOwnerId === partnerId
        ? { title: isCollector ? 'Added to your cellar' : 'Transferred to you', kind: 'in' as const }
        : { title: isCollector ? 'Transferred from your cellar' : 'Transferred to another owner', kind: 'out' as const };
    }
    if (row.movementType === 'pick' || row.movementType === 'dispatch') {
      const delivery = row.orderId ? deliveries.get(row.orderId) : undefined;
      const verb = row.movementType === 'pick' ? 'Picked' : 'Dispatched';
      if (delivery && delivery.ownerId === partnerId) {
        return { title: `${verb} for your delivery`, kind: 'out' as const };
      }
      if (isCollector && row.salesOrderNumber && row.customerName) {
        return { title: `${verb} · sold to ${row.customerName}`, kind: 'out' as const };
      }
      if (isCollector && row.pcoNumber) {
        return { title: `${verb} · sold to a private client`, kind: 'out' as const };
      }
    }
    return base;
  };

  return rows.map((row) => {
    const event = describe(row);

    return {
      id: `stock-${row.id}`,
      stream: 'stock' as const,
      kind: event.kind,
      at: row.performedAt,
      title: event.title,
      subject: row.productName,
      quantity: quantityOf(row.lwin18, row.quantityCases, row.quantityBottles),
      bottles: bottlesOf(row.lwin18, row.quantityCases, row.quantityBottles),
      orderRef: event.kind === 'out' ? (row.pcoNumber ?? row.salesOrderNumber ?? null) : null,
      // Bays mean little to an owner; kept as the small print
      detail:
        row.fromLocation && row.toLocation
          ? `${row.fromLocation} → ${row.toLocation}`
          : row.fromLocation
            ? `from ${row.fromLocation}`
            : row.toLocation
              ? `into ${row.toLocation}`
              : null,
      reference: row.movementNumber,
    };
  });
};

export default getStockActivity;
