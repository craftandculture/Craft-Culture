import { and, eq } from 'drizzle-orm';

import db from '@/database/client';
import { cellarAccessGrants } from '@/database/schema';

import resolveCellarRole from '../utils/resolveCellarRole';

/** Postgres: relation does not exist */
const UNDEFINED_TABLE = '42P01';

const isMissingTable = (error: unknown) => {
  const codeOf = (value: unknown) =>
    typeof value === 'object' && value !== null && 'code' in value
      ? (value as { code?: unknown }).code
      : undefined;

  return (
    codeOf(error) === UNDEFINED_TABLE ||
    codeOf((error as { cause?: unknown } | null)?.cause) === UNDEFINED_TABLE
  );
};

/**
 * A signed-in person's role in the cellar they resolved to
 *
 * Only a missing table is forgiven, and read as "holder": until the migration
 * has run nobody can have been given shared access, so that is exactly true.
 * Any other failure is thrown — reading an error as full access would hand a
 * viewer the holder's rights whenever the database hiccupped.
 *
 * @param partnerId - The cellar
 * @param userId - The signed-in person
 * @returns holder, manager, viewer, or revoked
 */
const getCellarRole = async (partnerId: string, userId: string) => {
  try {
    const grants = await db
      .select({
        role: cellarAccessGrants.role,
        status: cellarAccessGrants.status,
      })
      .from(cellarAccessGrants)
      .where(
        and(
          eq(cellarAccessGrants.partnerId, partnerId),
          eq(cellarAccessGrants.userId, userId),
        ),
      );

    return resolveCellarRole(grants);
  } catch (error) {
    if (isMissingTable(error)) return 'holder' as const;
    throw error;
  }
};

export default getCellarRole;
