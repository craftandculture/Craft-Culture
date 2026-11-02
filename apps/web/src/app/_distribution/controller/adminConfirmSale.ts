import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import reattributeMonth from '../data/reattributeMonth';
import { confirmedLinksReady } from '../utils/codeBridge';
import tableReady from '../utils/tableReady';

/**
 * Answer a sale from the queue: this code is this wine, or it is not ours
 *
 * The answer is kept as a link against the code, so it holds for every month
 * that code appears in, and the month is re-attributed at once so the bottles
 * move onto their owner's statement without a second step.
 *
 * "Not ours" files the code as City Drinks' own stock: their bottles, billed
 * to nobody and paid to nobody.
 *
 * @param outletId - The outlet
 * @param month - The month the line is waiting in, YYYY-MM
 * @param outletCode - Their code, e.g. CDR8413460587
 * @param lwin18 - The wine it is, as held on our invoice line
 * @param ownerId - Whose it is, for a wine more than one owner consigns
 * @param notOurs - It is the outlet's own stock
 * @returns The month's attribution after the answer
 */
const adminConfirmSale = adminProcedure
  .input(
    z
      .object({
        outletId: z.string().uuid(),
        month: z.string().regex(/^\d{4}-\d{2}$/, 'Expected a YYYY-MM month'),
        outletCode: z.string().min(1).max(120),
        lwin18: z.string().min(1).max(50).optional(),
        ownerId: z.string().uuid().optional(),
        notOurs: z.boolean().optional(),
        outletProductName: z.string().max(300).optional(),
        ourProductName: z.string().max(300).optional(),
      })
      .refine((value) => Boolean(value.lwin18) !== Boolean(value.notOurs), {
        message: 'Choose the wine, or mark it not ours — one of the two.',
      }),
  )
  .mutation(async ({ input, ctx }) => {
    if (!(await confirmedLinksReady())) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Code links are not available yet on this database.',
      });
    }

    const lwin18 = input.notOurs ? 'NOT-OURS' : input.lwin18!;
    const ownerId = input.notOurs ? null : (input.ownerId ?? null);
    const keepsOwner = await tableReady('cons_invoice_types');

    if (ownerId && !keepsOwner) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Choosing an owner is not available until the latest migration has run.',
      });
    }

    await client`
      INSERT INTO cons_code_links ${client({
        outlet_id: input.outletId,
        outlet_code: input.outletCode,
        lwin18,
        outlet_product_name: input.outletProductName ?? null,
        our_product_name: input.notOurs ? null : (input.ourProductName ?? null),
        source: input.notOurs ? 'not-ours' : 'queue',
        confirmed_by: ctx.user.id,
        ...(keepsOwner ? { owner_id: ownerId } : {}),
      })}
      ON CONFLICT (outlet_id, outlet_code) DO UPDATE SET
        lwin18 = EXCLUDED.lwin18,
        ${keepsOwner ? client`owner_id = EXCLUDED.owner_id,` : client``}
        outlet_product_name = COALESCE(
          EXCLUDED.outlet_product_name, cons_code_links.outlet_product_name
        ),
        our_product_name = EXCLUDED.our_product_name,
        source = EXCLUDED.source,
        confirmed_by = EXCLUDED.confirmed_by,
        updated_at = NOW()
    `;

    return reattributeMonth({ outletId: input.outletId, month: input.month });
  });

export default adminConfirmSale;
