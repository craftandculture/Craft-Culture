import { and, asc, eq, inArray, sql } from 'drizzle-orm';

import db from '@/database/client';
import type { Partner } from '@/database/schema';
import { partnerMembers, partners } from '@/database/schema';

/** The partner types a login can be attached to */
export type LinkablePartnerType =
  | 'wine_partner'
  | 'distributor'
  | 'private_collector';

/**
 * Find the partner a user acts on behalf of
 *
 * There are three ways a user comes to be linked to a partner, and they are
 * checked in order of authority: an explicit membership granted by an admin,
 * ownership of the partner record, and finally the legacy `users.partnerId`
 * column that predates both.
 *
 * This lookup was written out three separate times — twice in
 * `lib/trpc/procedures.ts` and again in `usersGetMe` — each with the partner
 * type hard-coded. Adding a fourth type by copying it a third time is how the
 * copies drift apart, and a nav that disagrees with an API gate is a user
 * staring at a link that then refuses them.
 *
 * @example
 *   const partner = await resolvePartnerForUser(userId, ['wine_partner']);
 *
 * @param userId - The signed-in user
 * @param types - Which partner types are acceptable to the caller
 * @param legacyPartnerId - The user's own `partnerId`, for the deprecated path
 * @returns The partner, or null when the user is linked to none of these types
 */
const resolvePartnerForUser = async (
  userId: string,
  types: LinkablePartnerType[],
  legacyPartnerId?: string | null,
): Promise<Partner | null> => {
  /*
    Deterministic, and active first. A user can hold more than one link — a
    membership on a record that has since been merged and retired, say — and
    `LIMIT 1` with no ORDER BY let Postgres pick either, so the same login
    could resolve to a different partner from one request to the next. Each
    path is ordered (active before inactive, then oldest link first), and an
    active partner on any path wins over an inactive one on a stronger path.
    An inactive partner is still returned when it is the only link, so callers
    can say "your account is not active" rather than "you are not linked".
  */
  const activeFirst = sql`CASE WHEN ${partners.status} = 'active' THEN 0 ELSE 1 END`;

  // PRIMARY: an admin-granted membership
  const [membership] = await db
    .select({ partner: partners })
    .from(partnerMembers)
    .innerJoin(partners, eq(partnerMembers.partnerId, partners.id))
    .where(
      and(eq(partnerMembers.userId, userId), inArray(partners.type, types)),
    )
    .orderBy(activeFirst, asc(partnerMembers.createdAt), asc(partners.id))
    .limit(1);

  if (membership?.partner.status === 'active') return membership.partner;

  // FALLBACK 1: the user owns the partner record
  const [owned] = await db
    .select()
    .from(partners)
    .where(and(eq(partners.userId, userId), inArray(partners.type, types)))
    .orderBy(activeFirst, asc(partners.createdAt), asc(partners.id))
    .limit(1);

  if (owned?.status === 'active') return owned;

  // FALLBACK 2: the deprecated column on the user
  const [legacy] = legacyPartnerId
    ? await db
        .select()
        .from(partners)
        .where(
          and(eq(partners.id, legacyPartnerId), inArray(partners.type, types)),
        )
        .limit(1)
    : [];

  const candidates = [membership?.partner, owned, legacy].filter(
    (p): p is Partner => !!p,
  );

  return (
    candidates.find((p) => p.status === 'active') ?? candidates[0] ?? null
  );
};

export default resolvePartnerForUser;
