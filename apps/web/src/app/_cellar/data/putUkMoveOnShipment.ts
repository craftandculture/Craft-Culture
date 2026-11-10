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

import { CLOSED_SHIPMENT_STATUSES } from '../constants/closedShipmentStatuses';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Put an accepted UK move's lines on an inbound shipment and mark it shipping
 *
 * The one place a move meets a shipment, whether staff ship a move from the
 * moves list or add a member's UK wine from the shipment itself.
 *
 * A shipment that is the member's is never for sale. On any other shipment —
 * C&C's, another member's in the same container, or one with no client set —
 * each line names the member as its owner, so receiving books it to the
 * member's cellar.
 *
 * A shipment with no client used to be adopted whole for the member, which
 * also made every other line on it theirs and took it off sale. The wine on
 * an unowned shipment is not known to be the member's, so only their own
 * lines are marked as theirs. A shipment whose receiving has started or is
 * closed is refused, as when adding UK wine from the shipment: a line added
 * now would never be received.
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
      status: logisticsShipments.status,
    })
    .from(logisticsShipments)
    .where(eq(logisticsShipments.id, params.shipmentId))
    .limit(1);

  if (!shipment || shipment.type !== 'inbound') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Choose an inbound shipment.' });
  }

  if (CLOSED_SHIPMENT_STATUSES.includes(shipment.status)) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'Receiving has started on this shipment, so its lines can no longer change.',
    });
  }

  const isMembersShipment = shipment.partnerId === params.partnerId;

  if (isMembersShipment && !shipment.notForSale) {
    await tx
      .update(logisticsShipments)
      .set({ notForSale: true, updatedAt: new Date() })
      .where(eq(logisticsShipments.id, shipment.id));
  }

  const items = await tx.select().from(cellarUkMoveItems).where(eq(cellarUkMoveItems.moveId, params.moveId));

  const bottleSizeMl = (litres: number | null) => (litres ? Math.round(litres * 1000) : 750);

  const ownerOverride = isMembersShipment
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
