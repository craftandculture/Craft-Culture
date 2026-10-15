import { TRPCError } from '@trpc/server';
import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsStock, wmsStockReservations, zohoDraftHoldLines, zohoDraftHolds } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { refreshDraftHold, releaseDraftHold } from '../data/draftHolds';

/**
 * Draft holds: every draft whose wine is held, with what each line holds
 *
 * Active holds first; confirmed and released ones from the last fortnight
 * after them, so the team can see where a hold went.
 */
export const adminListDraftHolds = adminProcedure.query(async () => {
  const holds = await db
    .select()
    .from(zohoDraftHolds)
    .where(
      sql`${zohoDraftHolds.status} = 'active' OR ${zohoDraftHolds.updatedAt} > now() - interval '14 days'`,
    )
    .orderBy(sql`${zohoDraftHolds.status} = 'active' DESC`, desc(zohoDraftHolds.updatedAt));

  if (!holds.length) return [];

  const ids = holds.map((h) => h.id);
  const [lines, held] = await Promise.all([
    db.select().from(zohoDraftHoldLines).where(inArray(zohoDraftHoldLines.holdId, ids)),
    db
      .select({
        orderItemId: wmsStockReservations.orderItemId,
        cases: sql<number>`sum(${wmsStockReservations.quantityCases})::int`,
        bottles: sql<number>`sum(${wmsStockReservations.quantityCases} * coalesce(${wmsStock.caseConfig}, 1))::int`,
      })
      .from(wmsStockReservations)
      .innerJoin(wmsStock, eq(wmsStock.id, wmsStockReservations.stockId))
      .where(
        and(
          eq(wmsStockReservations.orderType, 'zoho_draft'),
          inArray(wmsStockReservations.orderId, ids),
          eq(wmsStockReservations.status, 'active'),
        ),
      )
      .groupBy(wmsStockReservations.orderItemId),
  ]);
  const heldBy = new Map(held.map((h) => [h.orderItemId, h]));

  return holds.map((h) => ({
    id: h.id,
    number: h.salesOrderNumber,
    customerName: h.customerName,
    status: h.status as 'active' | 'confirmed' | 'released',
    statusReason: h.statusReason,
    lastRefreshedAt: h.lastRefreshedAt,
    createdAt: h.createdAt,
    lines: lines
      .filter((l) => l.holdId === h.id)
      .map((l) => ({
        id: l.id,
        name: l.name,
        sku: l.sku,
        quantity: l.quantity,
        unit: l.unit,
        casesHeld: heldBy.get(l.id)?.cases ?? 0,
        bottlesHeld: heldBy.get(l.id)?.bottles ?? 0,
      })),
  }));
});

/** Re-read a held draft from Zoho and bring its hold up to date */
export const adminRefreshDraftHold = adminProcedure
  .input(z.object({ holdId: z.string().uuid() }))
  .mutation(async ({ input }) => {
    const result = await refreshDraftHold({ db, holdId: input.holdId });
    if (result.outcome === 'unreachable') {
      throw new TRPCError({ code: 'BAD_GATEWAY', message: 'Zoho could not be reached; try again shortly' });
    }
    return result;
  });

/** Stop holding a draft's wine and give every case back */
export const adminReleaseDraftHold = adminProcedure
  .input(z.object({ holdId: z.string().uuid() }))
  .mutation(async ({ input, ctx }) => {
    const [hold] = await db
      .select({ id: zohoDraftHolds.id })
      .from(zohoDraftHolds)
      .where(and(eq(zohoDraftHolds.id, input.holdId), ne(zohoDraftHolds.status, 'released')));
    if (!hold) throw new TRPCError({ code: 'NOT_FOUND', message: 'That hold is not active' });
    return releaseDraftHold({ db, holdId: hold.id, reason: `Released by ${ctx.user.name}` });
  });
