import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';

import db from '@/database/client';
import { passkeys } from '@/database/schema';

interface PasskeysDeleteInput {
  id: string;
  userId: string;
}

/**
 * Delete a passkey for a user
 */
const passkeysDeleteController = async ({ id, userId }: PasskeysDeleteInput) => {
  // Verify the passkey belongs to the user
  const [passkey] = await db
    .select({ id: passkeys.id })
    .from(passkeys)
    .where(and(eq(passkeys.id, id), eq(passkeys.userId, userId)))
    .limit(1);

  if (!passkey) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Passkey not found',
    });
  }

  // Delete the passkey
  await db
    .delete(passkeys)
    .where(and(eq(passkeys.id, id), eq(passkeys.userId, userId)));

  return { success: true };
};

export default passkeysDeleteController;
