import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { passkeys } from '@/database/schema';

interface PasskeysListInput {
  userId: string;
}

/**
 * List all passkeys for a user
 */
const passkeysListController = async ({ userId }: PasskeysListInput) => {
  const userPasskeys = await db
    .select({
      id: passkeys.id,
      name: passkeys.name,
      credentialID: passkeys.credentialID,
      deviceType: passkeys.deviceType,
      createdAt: passkeys.createdAt,
    })
    .from(passkeys)
    .where(eq(passkeys.userId, userId))
    .orderBy(passkeys.createdAt);

  return userPasskeys;
};

export default passkeysListController;
