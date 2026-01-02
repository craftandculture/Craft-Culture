import { TRPCError } from '@trpc/server';

import db from '@/database/client';

import { t } from './trpc';

/**
 * Public (unauthed) procedure
 *
 * This is the base piece you use to build new queries and mutations on your
 * tRPC API. It does not guarantee that a user querying is authorized, but you
 * can still access user session data if they are logged in
 */
export const publicProcedure = t.procedure;

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use
 * this. It verifies the session is valid and guarantees `ctx.session.user` is
 * not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  return next({
    ctx: {
      user: ctx.user,
    },
  });
});

/**
 * Admin procedure
 *
 * Only accessible to users with admin role.
 * Verifies the user is authenticated and has admin role.
 *
 * @see https://trpc.io/docs/procedures
 */
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  ctx.accessControl(() => ctx.user.role === 'admin');

  return await next({ ctx });
});

/**
 * Wine Partner procedure
 *
 * Accessible to users linked to a wine partner (wine company) via:
 * 1. Direct link (partners.userId) - owner access
 * 2. Member link (partnerMembers table) - staff access
 *
 * Users must be explicitly linked to a wine partner by an admin.
 * Injects the partnerId into the context for data isolation.
 */
export const winePartnerProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    const { eq, and } = await import('drizzle-orm');
    const { partners, partnerMembers } = await import('@/database/schema');

    // First, check direct partner link (owner) - must be wine_partner type
    let partner = await db.query.partners.findFirst({
      where: and(
        eq(partners.userId, ctx.user.id),
        eq(partners.type, 'wine_partner'),
      ),
    });

    // If no direct link, check partnerMembers table for wine partner membership
    if (!partner) {
      const membership = await db
        .select({ partner: partners })
        .from(partnerMembers)
        .innerJoin(partners, eq(partnerMembers.partnerId, partners.id))
        .where(
          and(
            eq(partnerMembers.userId, ctx.user.id),
            eq(partners.type, 'wine_partner'),
          ),
        )
        .limit(1);

      if (membership.length > 0 && membership[0]) {
        partner = membership[0].partner;
      }
    }

    if (!partner) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message:
          'You are not linked to a wine partner. Contact admin to be assigned.',
      });
    }

    if (partner.status !== 'active') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Your partner account is not active',
      });
    }

    return await next({
      ctx: {
        ...ctx,
        partner,
        partnerId: partner.id,
      },
    });
  },
);

/**
 * Distributor procedure
 *
 * Accessible to users linked to a distributor (CD or TBS) via:
 * 1. Direct link (partners.userId) - owner access
 * 2. Member link (partnerMembers table) - staff access
 *
 * Users must be explicitly linked to a distributor by an admin.
 * Injects the partnerId into the context for data isolation.
 */
export const distributorProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    const { eq, and } = await import('drizzle-orm');
    const { partners, partnerMembers } = await import('@/database/schema');

    // First, check direct partner link (owner) - must be distributor type
    let partner = await db.query.partners.findFirst({
      where: and(
        eq(partners.userId, ctx.user.id),
        eq(partners.type, 'distributor'),
      ),
    });

    // If no direct link, check partnerMembers table for distributor membership
    if (!partner) {
      const membership = await db
        .select({ partner: partners })
        .from(partnerMembers)
        .innerJoin(partners, eq(partnerMembers.partnerId, partners.id))
        .where(
          and(
            eq(partnerMembers.userId, ctx.user.id),
            eq(partners.type, 'distributor'),
          ),
        )
        .limit(1);

      if (membership.length > 0 && membership[0]) {
        partner = membership[0].partner;
      }
    }

    if (!partner) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message:
          'You are not linked to a distributor. Contact admin to be assigned.',
      });
    }

    if (partner.status !== 'active') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Your distributor account is not active',
      });
    }

    return await next({
      ctx: {
        ...ctx,
        partner,
        partnerId: partner.id,
      },
    });
  },
);
