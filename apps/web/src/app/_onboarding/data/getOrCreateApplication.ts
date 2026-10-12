import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { cellarApplications } from '@/database/schema';

/**
 * The signed-in person's Private Cellar application, created on first visit
 *
 * Created as a draft so each step can be saved and finished later. Nothing
 * else — no partner, no membership — exists until it is submitted.
 *
 * @param userId - The signed-in user
 * @param fullName - Their name as the account holds it, to prefill step one
 * @returns The application
 */
const getOrCreateApplication = async (userId: string, fullName?: string | null) => {
  const [existing] = await db
    .select()
    .from(cellarApplications)
    .where(eq(cellarApplications.userId, userId))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(cellarApplications)
    .values({ userId, fullName: fullName ?? null })
    .onConflictDoNothing()
    .returning();

  if (created) return created;

  // Two tabs opened at once: the other one won, so read what it made
  const [raced] = await db
    .select()
    .from(cellarApplications)
    .where(eq(cellarApplications.userId, userId))
    .limit(1);

  return raced!;
};

export default getOrCreateApplication;
