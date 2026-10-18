import { and, desc, eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import { cellarAccessGrants } from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

/**
 * Who has access to this cellar, and who the signed-in person is to it
 *
 * The holder sees everyone they have invited. Someone the cellar is shared
 * with sees only their own level of access and whose cellar it is — not the
 * other people the holder has chosen to share it with.
 *
 * Guarded: a missing table reads as nobody else having access.
 *
 * @example
 *   const { myRole, people } = await trpcClient.cellar.member.getAccess.query();
 */
const memberGetAccess = stockOwnerProcedure.query(async ({ ctx }) => {
  const base = {
    myRole: ctx.cellarRole,
    holderName: ctx.partner.businessName,
  };

  if (ctx.cellarRole !== 'holder') return { ...base, people: [] };

  try {
    const people = await db
      .select({
        id: cellarAccessGrants.id,
        name: cellarAccessGrants.name,
        email: cellarAccessGrants.email,
        role: cellarAccessGrants.role,
        status: cellarAccessGrants.status,
        expiresAt: cellarAccessGrants.expiresAt,
        acceptedAt: cellarAccessGrants.acceptedAt,
        createdAt: cellarAccessGrants.createdAt,
      })
      .from(cellarAccessGrants)
      .where(
        and(
          eq(cellarAccessGrants.partnerId, ctx.partner.id),
          inArray(cellarAccessGrants.status, ['invited', 'active']),
        ),
      )
      .orderBy(desc(cellarAccessGrants.createdAt));

    return {
      ...base,
      people: people.map((person) => ({
        ...person,
        isExpired:
          person.status === 'invited' && person.expiresAt < new Date(),
      })),
    };
  } catch (error) {
    logger.error('Could not read who has access to a cellar', {
      partnerId: ctx.partner.id,
      error,
    });
    return { ...base, people: [] };
  }
});

export default memberGetAccess;
