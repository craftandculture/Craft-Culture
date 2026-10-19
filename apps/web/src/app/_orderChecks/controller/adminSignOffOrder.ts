import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import orderCheckFilesReady from '../utils/orderCheckFilesReady';

/**
 * Record that a person has reviewed an order's paperwork
 *
 * The check reports; it never approves. Signing off records who reviewed the
 * order and what the check said at that moment, so an order signed off with an
 * open difference is visibly that, rather than looking clean. Pressing it again
 * after a change re-signs with the newer result.
 *
 * @example
 *   await trpcClient.orderChecks.signOff.mutate({ soNumber: 'SO-00198' });
 */
const adminSignOffOrder = adminProcedure
  .input(z.object({ soNumber: z.string().trim().min(2).max(40) }))
  .mutation(async ({ input, ctx }) => {
    if (!(await orderCheckFilesReady())) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Sign-off is not available yet: the order-check table has not been created on this deployment',
      });
    }

    const [row] = await client<{ status: string | null }[]>`
      UPDATE order_check_files
      SET signed_off_by = ${ctx.user.id}, signed_off_at = now(), signed_off_status = last_status, updated_at = now()
      WHERE so_number = ${input.soNumber.toUpperCase()} AND last_checked_at IS NOT NULL
      RETURNING signed_off_status AS status
    `;

    if (!row) {
      throw new TRPCError({ code: 'NOT_FOUND', message: `Check ${input.soNumber} before signing it off` });
    }

    return { soNumber: input.soNumber.toUpperCase(), status: row.status, by: ctx.user.name ?? ctx.user.email, at: new Date() };
  });

export default adminSignOffOrder;
