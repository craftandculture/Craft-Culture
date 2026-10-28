import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { productUpdates } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import productUpdateInputSchema from '../schemas/productUpdateInputSchema';
import linkLabelFor from '../utils/linkLabelFor';

/**
 * Save an update's wording, or write a new one by hand
 *
 * Saving never publishes. An update already live stays live with its new
 * wording, which is how a typo is put right.
 */
const adminSave = staffAdminProcedure.input(productUpdateInputSchema).mutation(async ({ input, ctx }) => {
  const values = {
    type: input.type,
    audiences: input.audiences,
    title: input.title,
    body: input.body,
    linkPath: linkLabelFor(input.linkPath) ? input.linkPath : null,
  };

  if (input.id) {
    const [row] = await db
      .update(productUpdates)
      .set(values)
      .where(eq(productUpdates.id, input.id))
      .returning({ id: productUpdates.id });

    if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'That update no longer exists' });

    return row;
  }

  const [row] = await db
    .insert(productUpdates)
    .values({ ...values, status: 'draft', createdBy: ctx.user.id })
    .returning({ id: productUpdates.id });

  if (!row) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'The update was not saved' });

  return row;
});

export default adminSave;
