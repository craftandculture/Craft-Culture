import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientContacts } from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

const deleteSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Delete a client contact
 */
const deleteContact = winePartnerProcedure.input(deleteSchema).mutation(async ({ input, ctx }) => {
  const { id } = input;
  const { partnerId } = ctx;

  // Verify ownership
  const existing = await db.query.privateClientContacts.findFirst({
    where: { id, partnerId },
  });

  if (!existing) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Client contact not found',
    });
  }

  // Check if there are any orders linked to this contact
  const linkedOrders = await db.query.privateClientOrders.findFirst({
    where: { partnerId, clientId: id },
  });

  if (linkedOrders) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Cannot delete client with existing orders. Archive the client instead.',
    });
  }

  await db
    .delete(privateClientContacts)
    .where(and(eq(privateClientContacts.id, id), eq(privateClientContacts.partnerId, partnerId)));

  return { success: true };
});

export default deleteContact;
