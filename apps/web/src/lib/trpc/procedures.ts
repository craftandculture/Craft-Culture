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
 * Only accessible to users linked to a wine_partner type partner.
 * Injects the partnerId into the context for data isolation.
 */
export const winePartnerProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    // Find the partner linked to this user
    const partner = await db.query.partners.findFirst({
      where: { userId: ctx.user.id },
    });

    if (!partner) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You are not linked to a partner account',
      });
    }

    if (partner.type !== 'wine_partner') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'This action requires a wine partner account',
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
 * Accessible to users linked to a distributor partner OR B2B users.
 * For B2B users without a partner, auto-creates a distributor partner.
 * Injects the partnerId into the context for data isolation.
 */
export const distributorProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    // Find the partner linked to this user
    let partner = await db.query.partners.findFirst({
      where: { userId: ctx.user.id },
    });

    // For B2B users, auto-create a distributor partner if none exists
    if (!partner && ctx.user.customerType === 'b2b') {
      const { partners } = await import('@/database/schema');
      const [newPartner] = await db
        .insert(partners)
        .values({
          userId: ctx.user.id,
          businessName: ctx.user.name || 'B2B Distributor',
          type: 'distributor',
          status: 'active',
        })
        .returning();
      partner = newPartner;
    }

    if (!partner) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You are not linked to a partner account',
      });
    }

    // Allow B2B users even if their partner type isn't explicitly 'distributor'
    if (partner.type !== 'distributor' && ctx.user.customerType !== 'b2b') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'This action requires a distributor account',
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
