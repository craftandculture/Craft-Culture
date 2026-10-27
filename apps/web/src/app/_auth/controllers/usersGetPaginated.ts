import { and, desc, eq, ilike, inArray, notExists, or, sql } from 'drizzle-orm';
import z from 'zod';

import db from '@/database/client';
import { partnerMembers, partners, sessions, users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get paginated list of users with filtering and search
 *
 * Admin-only endpoint for user management. Each row carries the
 * organisations the user acts for, so the list needs one query for them
 * rather than one per row, and the response carries the counts the screen's
 * tiles show.
 *
 * `focus` narrows to the questions the tiles ask, and each tile's count is
 * the same condition, so a tile can never show a number its filter disagrees
 * with:
 * - `pending` — awaiting approval
 * - `team` — C&C staff (admins and warehouse operators)
 * - `partners` / `distributors` — external logins of that kind
 * - `unlinked` — a partner or distributor login linked to no organisation,
 *   which signs in to an empty account
 * - `never` — has never signed in
 */
const usersGetPaginated = adminProcedure
  .input(
    z.object({
      cursor: z.number().optional().default(0),
      limit: z.number().min(1).max(200).optional().default(50),
      status: z.enum(['pending', 'approved', 'rejected']).optional(),
      customerType: z.enum(['b2b', 'b2c', 'private_clients']).optional(),
      focus: z
        .enum(['pending', 'team', 'partners', 'distributors', 'unlinked', 'never'])
        .optional(),
      search: z.string().optional(),
    }),
  )
  .query(async ({ input }) => {
    const { cursor, limit, status, customerType, focus, search } = input;

    const hasMembership = db
      .select({ one: sql`1` })
      .from(partnerMembers)
      .where(eq(partnerMembers.userId, users.id));
    const ownsPartner = db
      .select({ one: sql`1` })
      .from(partners)
      .where(eq(partners.userId, users.id));
    const hasSession = db
      .select({ one: sql`1` })
      .from(sessions)
      .where(eq(sessions.userId, users.id));

    // One definition, used by both the filter and its tile count
    const isTeam = inArray(users.role, ['admin', 'wms_operator']);
    const isUnlinked = and(
      eq(users.role, 'user'),
      inArray(users.customerType, ['b2b', 'private_clients']),
      notExists(hasMembership),
      notExists(ownsPartner),
    );
    const isNever = and(notExists(hasSession), sql`${users.isTestUser} is not true`);
    const isPending = eq(users.approvalStatus, 'pending');
    const isPartnerAccount = and(eq(users.customerType, 'private_clients'), eq(users.role, 'user'));
    const isDistributor = and(eq(users.customerType, 'b2b'), eq(users.role, 'user'));

    const whereConditions = [];

    if (status) {
      whereConditions.push(eq(users.approvalStatus, status));
    }

    if (customerType) {
      whereConditions.push(eq(users.customerType, customerType));
    }

    const focusCondition = {
      pending: isPending,
      team: isTeam,
      partners: isPartnerAccount,
      distributors: isDistributor,
      unlinked: isUnlinked,
      never: isNever,
    };
    if (focus) whereConditions.push(focusCondition[focus]);

    if (search && search.trim().length > 0) {
      const searchTerm = `%${search.trim()}%`;
      whereConditions.push(
        or(ilike(users.name, searchTerm), ilike(users.email, searchTerm)),
      );
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Subquery to get the most recent session (last login) for each user
    const lastLoginSubquery = db
      .select({
        userId: sessions.userId,
        lastLogin: sql<Date>`MAX(${sessions.createdAt})`.as('last_login'),
      })
      .from(sessions)
      .groupBy(sessions.userId)
      .as('last_login_sq');

    const [usersResult, [countResult], [counts]] = await Promise.all([
      db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          customerType: users.customerType,
          role: users.role,
          approvalStatus: users.approvalStatus,
          approvedAt: users.approvedAt,
          approvedBy: users.approvedBy,
          isTestUser: users.isTestUser,
          createdAt: users.createdAt,
          onboardingCompletedAt: users.onboardingCompletedAt,
          lastLogin: lastLoginSubquery.lastLogin,
          // Another account with the same address in different case: one of the two is a stray copy
          sharesEmail: sql<boolean>`exists (select 1 from users u2 where lower(u2.email) = lower(${users.email}) and u2.id <> ${users.id})`,
        })
        .from(users)
        .leftJoin(lastLoginSubquery, eq(users.id, lastLoginSubquery.userId))
        .where(whereClause)
        // Waiting on a decision first, then newest
        .orderBy(sql`${users.approvalStatus} = 'pending' desc`, desc(users.createdAt))
        .limit(limit + 1)
        .offset(cursor),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(whereClause),
      db
        .select({
          all: sql<number>`count(*)::int`,
          pending: sql<number>`count(*) filter (where ${isPending})::int`,
          team: sql<number>`count(*) filter (where ${isTeam})::int`,
          partnerAccounts: sql<number>`count(*) filter (where ${isPartnerAccount})::int`,
          distributors: sql<number>`count(*) filter (where ${isDistributor})::int`,
          unlinked: sql<number>`count(*) filter (where ${isUnlinked})::int`,
          never: sql<number>`count(*) filter (where ${isNever})::int`,
        })
        .from(users),
    ]);

    const page = usersResult.slice(0, limit);
    const ids = page.map((u) => u.id);

    // Who each user acts for: memberships, plus the legacy direct link
    const [memberRows, ownerRows] =
      ids.length === 0
        ? [[], []]
        : await Promise.all([
            db
              .select({
                userId: partnerMembers.userId,
                id: partners.id,
                name: partners.businessName,
                type: partners.type,
              })
              .from(partnerMembers)
              .innerJoin(partners, eq(partnerMembers.partnerId, partners.id))
              .where(inArray(partnerMembers.userId, ids)),
            db
              .select({
                userId: partners.userId,
                id: partners.id,
                name: partners.businessName,
                type: partners.type,
              })
              .from(partners)
              .where(inArray(partners.userId, ids)),
          ]);

    const organizationsByUser = new Map<
      string,
      { id: string; name: string; type: string }[]
    >();
    for (const row of [...memberRows, ...ownerRows]) {
      if (!row.userId) continue;
      const list = organizationsByUser.get(row.userId) ?? [];
      if (!list.some((o) => o.id === row.id)) {
        list.push({ id: row.id, name: row.name, type: row.type });
      }
      organizationsByUser.set(row.userId, list);
    }

    const nextCursor = usersResult.length > limit ? cursor + limit : undefined;

    return {
      data: page.map((u) => ({
        ...u,
        organizations: organizationsByUser.get(u.id) ?? [],
      })),
      meta: {
        nextCursor,
        totalCount: countResult?.count ?? 0,
        counts: counts ?? {
          all: 0,
          pending: 0,
          team: 0,
          partnerAccounts: 0,
          distributors: 0,
          unlinked: 0,
          never: 0,
        },
      },
    };
  });

export type UsersGetPaginatedOutput = Awaited<ReturnType<typeof usersGetPaginated>>;

export default usersGetPaginated;
