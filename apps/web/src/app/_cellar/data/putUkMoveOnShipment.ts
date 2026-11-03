import { TRPCError } from '@trpc/server';
import { and, eq, isNull } from 'drizzle-orm';

import type db from '@/database/client';
import {
  cellarUkMoveItems,
  cellarUkMoves,
  logisticsShipmentActivityLogs,
  logisticsShipmentItems,
  logisticsShipments,
} from '@/database/schema';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Put an accepted UK move's lines on an inbound shipment and mark it shipping
 *
 * The one place a move meets a shipment, whether staff ship a move from the
 * moves list or add a member's UK wine from the shipment itself.
 *
 * A shipment with no client becomes the member's, and a shipment that is the
 * member's is never for sale: SHP-2026-0040 was opened from a freight quote
 * with neither, so the member could not see it and receiving would have
 * booked their wine to nobody. On a shipment that belongs to someone else
 * (C&C, or another member in the same container) each line names the member
 * as its owner, so receiving books it to the member's cellar.
 *
 * @param tx - The transaction the move was resolved in
 * @param params.moveId - An accepted move not yet on a shipment
 * @param params.partnerId - The member the move is for
 * @param params.memberName - Named on lines that override the shipment's owner
 * @param params.shipmentId - The inbound shipment
 * @param params.userId - Who did it, for the shipment's activity log
 */
const putUkMoveOnShipment = async (
  tx: Tx,
  params: {
    moveId: string;
    moveNumber: string;
    partnerId: string;
    memberName: string | null;
    shipmentId: string;
    userId: string;
  },
) => {
  const [shipment] = await tx
    .select({
      id: logisticsShipments.id,
      type: logisticsShipments.type,
      partnerId: logisticsShipments.partnerId,
      notForSale: logisticsShipments.notForSale,
    })
    .from(logisticsShipments)
    .where(eq(logisticsShipments.id, params.shipmentId))
    .limit(1);

  if (!shipment || shipment.type !== 'inbound') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Choose an inbound shipment.' });
  }

  const ownerId = shipment.partnerId ?? params.partnerId;

  if (ownerId === params.partnerId && (!shipment.partnerId || !shipment.notForSale)) {
    await tx
      .update(logisticsShipments)
      .set({ partnerId: params.partnerId, notForSale: true, updatedAt: new Date() })
      .where(eq(logisticsShipments.id, shipment.id));
  }

  const items = await tx.select().from(cellarUkMoveItems).where(eq(cellarUkMoveItems.moveId, params.moveId));

  const bottleSizeMl = (litres: number | null) => (litres ? Math.round(litres * 1000) : 750);

  const ownerOverride =
    ownerId === params.partnerId
      ? {}
      : { overrideOwnerId: params.partnerId, overrideOwnerName: params.memberName };

  const lines = items.flatMap((item) => {
    const base = {
      shipmentId: shipment.id,
      productName: item.name,
      lwin: item.lwin18,
      vintage: item.vintage,
      bottleSizeMl: bottleSizeMl(item.bottleSizeLitres),
      notForSale: true,
      ...ownerOverride,
    };

    const caseLine =
      item.cases > 0 && item.bottlesPerCase
        ? [
            {
              ...base,
              cases: item.cases,
              bottlesPerCase: item.bottlesPerCase,
              totalBottles: item.cases * item.bottlesPerCase,
            },
          ]
        : [];

    const looseBottles = item.totalBottles - caseLine.reduce((sum, line) => sum + line.totalBottles, 0);

    const looseLine =
      looseBottles > 0 ? [{ ...base, cases: looseBottles, bottlesPerCase: 1, totalBottles: looseBottles }] : [];

    return [...caseLine, ...looseLine];
  });

  if (lines.length > 0) {
    await tx.insert(logisticsShipmentItems).values(lines);
  }

  const [claimed] = await tx
    .update(cellarUkMoves)
    .set({ status: 'shipping', shipmentId: shipment.id, shippedAt: new Date() })
    .where(
      and(
        eq(cellarUkMoves.id, params.moveId),
        eq(cellarUkMoves.status, 'accepted'),
        isNull(cellarUkMoves.shipmentId),
      ),
    )
    .returning({ id: cellarUkMoves.id });

  if (!claimed) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'This move was shipped by someone else a moment ago.',
    });
  }

  const cases = items.reduce((sum, item) => sum + item.cases, 0);

  await tx.insert(logisticsShipmentActivityLogs).values({
    shipmentId: shipment.id,
    userId: params.userId,
    action: 'item_added',
    notes: `UK move ${params.moveNumber} added: ${cases} ${cases === 1 ? 'case' : 'cases'} from LCB Burton for ${params.memberName ?? 'the member'}`,
  });
};

export default putUkMoveOnShipment;
