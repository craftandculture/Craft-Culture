import { TRPCError } from '@trpc/server';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsStock, wmsStockMovements } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

/**
 * Remove movements that were keyed in by mistake
 *
 * A muddled split of Le Pin's Trilogie case (3 magnums, 2011/12/13) on 6 and 9
 * Nov 2026 left a cycle count that invented two cases, a count that took them
 * away again, and two wrong-wine rows each added and zeroed. The stock ended
 * right, but the history and Maison Wineted's statement carried every step.
 * This takes those records out, rewrites the note on any movement kept, and
 * deletes stock rows the mistakes left empty.
 *
 * Only counts, adjustments and wine added by hand can be removed: anything that
 * moved wine in from a shipment, out to a client or between owners stays.
 * Quantities on stock rows are not changed, so remove offsetting records
 * together. Preview first (`dryRun`), then save.
 *
 * @example
 *   await trpcClient.wms.admin.stock.removeMistakenMovements.mutate({
 *   movementIds: [...], emptyStockIds: [...], renote: [{ movementId, notes }],
 *   reason: 'Le Pin Trilogie split keyed wrongly', dryRun: true,
 *   });
 */
const adminRemoveMistakenMovements = staffAdminProcedure
  .input(
    z.object({
      movementIds: z.array(z.string().uuid()).max(50).default([]),
      /** Rows the mistakes left at nothing */
      emptyStockIds: z.array(z.string().uuid()).max(20).default([]),
      /** New notes for movements that stay */
      renote: z
        .array(
          z.object({
            movementId: z.string().uuid(),
            notes: z.string().trim().min(3).max(500),
          }),
        )
        .max(20)
        .default([]),
      reason: z.string().trim().min(3).max(300),
      dryRun: z.boolean().default(true),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const removable = new Set(['count', 'adjust', 'receive']);
    const renoteIds = input.renote.map((r) => r.movementId);

    const movements = input.movementIds.length
      ? await db
          .select()
          .from(wmsStockMovements)
          .where(inArray(wmsStockMovements.id, input.movementIds))
      : [];
    const missing = input.movementIds.filter(
      (id) => !movements.some((m) => m.id === id),
    );
    if (missing.length)
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Movements not found: ${missing.join(', ')}`,
      });

    for (const m of movements) {
      // A receipt off a shipment is real wine arriving; only hand additions go
      if (
        !removable.has(m.movementType) ||
        (m.movementType === 'receive' &&
          m.shipmentId &&
          !m.notes?.startsWith('Added to stock'))
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `${m.movementNumber} is a ${m.movementType} and cannot be removed here.`,
        });
      }
      if (renoteIds.includes(m.id)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `${m.movementNumber} is both removed and kept.`,
        });
      }
    }

    const kept = renoteIds.length
      ? await db
          .select()
          .from(wmsStockMovements)
          .where(inArray(wmsStockMovements.id, renoteIds))
      : [];
    if (kept.length !== renoteIds.length)
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'A movement to renote was not found.',
      });

    const rows = input.emptyStockIds.length
      ? await db
          .select()
          .from(wmsStock)
          .where(inArray(wmsStock.id, input.emptyStockIds))
      : [];
    if (rows.length !== input.emptyStockIds.length)
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'A stock row was not found.',
      });
    for (const row of rows) {
      if (row.quantityCases !== 0 || row.reservedCases !== 0 || (row.openBottles ?? 0) !== 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `${row.productName} (${row.lwin18}) still holds ${row.quantityCases} case(s); only empty rows can be deleted.`,
        });
      }
    }

    const preview = {
      remove: movements.map((m) => ({
        movementNumber: m.movementNumber,
        type: m.movementType,
        lwin18: m.lwin18,
        cases: m.quantityCases,
        notes: m.notes,
      })),
      renote: kept.map((m) => ({
        movementNumber: m.movementNumber,
        from: m.notes,
        to: input.renote.find((r) => r.movementId === m.id)?.notes,
      })),
      deleteRows: rows.map((r) => ({
        lwin18: r.lwin18,
        productName: r.productName,
        owner: r.ownerName,
      })),
    };
    if (input.dryRun) return { saved: false, ...preview };

    await db.transaction(async (tx) => {
      if (movements.length)
        await tx
          .delete(wmsStockMovements)
          .where(inArray(wmsStockMovements.id, input.movementIds));
      for (const r of input.renote) {
        await tx
          .update(wmsStockMovements)
          .set({ notes: r.notes, updatedAt: new Date() })
          .where(inArray(wmsStockMovements.id, [r.movementId]));
      }
      if (rows.length)
        await tx
          .delete(wmsStock)
          .where(inArray(wmsStock.id, input.emptyStockIds));
    });

    // The records are gone from the ledger; the server log keeps what was removed and by whom
    console.info('removeMistakenMovements', {
      by: ctx.user.email,
      reason: input.reason,
      ...preview,
    });

    return { saved: true, ...preview };
  });

export default adminRemoveMistakenMovements;
