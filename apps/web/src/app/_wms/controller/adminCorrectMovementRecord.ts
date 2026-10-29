import { TRPCError } from '@trpc/server';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { partners, wmsStockMovements } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

/**
 * Correct whose bottles a movement moved, or the wine name it carries
 *
 * Statements, payouts and activity are all read from movements, so a pick or
 * transfer booked to the wrong owner puts a sale on the wrong statement. Two
 * on Ihab Toma's, found by Laraine on 29 Oct 2026:
 * - Yuvraj's own Limozin, delivered to him on SO-00130, booked as Ihab's
 *   bottles (set `fromOwnerId` to null, or to Yuvraj where he has a record);
 * - Montille Monthélie handed to C&C on 20 Oct and then picked for SO-00195
 *   from C&C, where the sale was Ihab's (point the transfer back at Ihab so it
 *   moves nothing, and the pick at Ihab).
 *
 * Only the record changes: stock rows and quantities are left as they are,
 * since the bottles have already gone. The movement's note keeps what it said
 * before. Picks and ownership transfers only.
 *
 * Preview first (`dryRun`), then save.
 *
 * @example
 *   await trpcClient.wms.admin.stock.correctMovementRecord.mutate({
 *     movementId, fromOwnerId: null, dryRun: true, note: 'Yuvraj\'s own wine',
 *   });
 */
const adminCorrectMovementRecord = staffAdminProcedure
  .input(
    z.object({
      movementId: z.string().uuid(),
      /** Omit to leave as is; null for bottles that were no member's */
      fromOwnerId: z.string().uuid().nullable().optional(),
      /** Ownership transfers only */
      toOwnerId: z.string().uuid().nullable().optional(),
      productName: z.string().trim().min(3).max(200).optional(),
      dryRun: z.boolean().default(true),
      note: z.string().trim().min(3).max(300),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const [movement] = await db
      .select()
      .from(wmsStockMovements)
      .where(eq(wmsStockMovements.id, input.movementId));
    if (!movement) throw new TRPCError({ code: 'NOT_FOUND', message: 'Movement not found' });
    if (movement.movementType !== 'pick' && movement.movementType !== 'ownership_transfer') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only a pick or an ownership transfer can be corrected here.' });
    }
    if (input.toOwnerId !== undefined && movement.movementType !== 'ownership_transfer') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only a transfer has an owner it went to.' });
    }

    const ids = [movement.fromOwnerId, movement.toOwnerId, input.fromOwnerId, input.toOwnerId].filter(
      (id): id is string => !!id,
    );
    const names = new Map(
      (ids.length
        ? await db
            .select({ id: partners.id, name: partners.businessName })
            .from(partners)
            .where(inArray(partners.id, ids))
        : []
      ).map((row) => [row.id, row.name]),
    );
    for (const id of [input.fromOwnerId, input.toOwnerId]) {
      if (id && !names.has(id)) throw new TRPCError({ code: 'NOT_FOUND', message: `Owner ${id} not found` });
    }
    const nameOf = (id: string | null | undefined) => (id ? (names.get(id) ?? id) : 'no owner');

    const changes: string[] = [];
    const set: Partial<typeof wmsStockMovements.$inferInsert> = {};
    if (input.fromOwnerId !== undefined && input.fromOwnerId !== movement.fromOwnerId) {
      set.fromOwnerId = input.fromOwnerId;
      changes.push(`from ${nameOf(movement.fromOwnerId)} → ${nameOf(input.fromOwnerId)}`);
    }
    if (input.toOwnerId !== undefined && input.toOwnerId !== movement.toOwnerId) {
      set.toOwnerId = input.toOwnerId;
      changes.push(`to ${nameOf(movement.toOwnerId)} → ${nameOf(input.toOwnerId)}`);
    }
    if (input.productName && input.productName !== movement.productName) {
      set.productName = input.productName;
      changes.push(`wine "${movement.productName}" → "${input.productName}"`);
    }
    if (!changes.length) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Nothing to change: the movement already says that.' });
    }

    const preview = {
      movementNumber: movement.movementNumber,
      movementType: movement.movementType,
      lwin18: movement.lwin18,
      changes,
    };
    if (input.dryRun) return { saved: false, ...preview };

    const by = ctx.user.name ?? ctx.user.email;
    const stamp = `Corrected by ${by} on ${new Date().toISOString().slice(0, 10)}: ${changes.join('; ')}. ${input.note}`;
    await db
      .update(wmsStockMovements)
      .set({ ...set, notes: movement.notes ? `${movement.notes}\n${stamp}` : stamp })
      .where(eq(wmsStockMovements.id, movement.id));

    return { saved: true, ...preview };
  });

export default adminCorrectMovementRecord;
