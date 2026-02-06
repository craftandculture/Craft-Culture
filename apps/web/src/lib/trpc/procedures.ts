import { TRPCError } from '@trpc/server';

import db from '@/database/client';
import serverConfig from '@/server.config';

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
 * 1. Member link (partnerMembers table) - PRIMARY source of truth
 * 2. Direct link (partners.userId) - owner access
 * 3. User's partnerId field - LEGACY fallback only
 *
 * Users must be explicitly linked to a wine partner by an admin.
 * Injects the partnerId into the context for data isolation.
 */
export const winePartnerProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    const { eq, and } = await import('drizzle-orm');
    const { partners, partnerMembers } = await import('@/database/schema');

    let partner;

    // PRIMARY: Check partnerMembers table first (admin-assigned memberships)
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

    // FALLBACK 1: Check direct partner link (owner)
    if (!partner) {
      const directPartnerResult = await db
        .select()
        .from(partners)
        .where(
          and(
            eq(partners.userId, ctx.user.id),
            eq(partners.type, 'wine_partner'),
          ),
        )
        .limit(1);

      partner = directPartnerResult[0];
    }

    // FALLBACK 2: Check legacy user.partnerId field (deprecated)
    if (!partner && ctx.user.partnerId) {
      const userPartnerResult = await db
        .select()
        .from(partners)
        .where(
          and(
            eq(partners.id, ctx.user.partnerId),
            eq(partners.type, 'wine_partner'),
          ),
        )
        .limit(1);

      partner = userPartnerResult[0];
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
 * 1. Member link (partnerMembers table) - PRIMARY source of truth
 * 2. Direct link (partners.userId) - owner access
 * 3. User's partnerId field - LEGACY fallback only
 *
 * Users must be explicitly linked to a distributor by an admin.
 * Injects the partnerId into the context for data isolation.
 */
export const distributorProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    const { eq, and } = await import('drizzle-orm');
    const { partners, partnerMembers } = await import('@/database/schema');

    let partner;

    // PRIMARY: Check partnerMembers table first (admin-assigned memberships)
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

    // FALLBACK 1: Check direct partner link (owner)
    if (!partner) {
      const directPartnerResult = await db
        .select()
        .from(partners)
        .where(
          and(
            eq(partners.userId, ctx.user.id),
            eq(partners.type, 'distributor'),
          ),
        )
        .limit(1);

      partner = directPartnerResult[0];
    }

    // FALLBACK 2: Check legacy user.partnerId field (deprecated)
    if (!partner && ctx.user.partnerId) {
      const userPartnerResult = await db
        .select()
        .from(partners)
        .where(
          and(
            eq(partners.id, ctx.user.partnerId),
            eq(partners.type, 'distributor'),
          ),
        )
        .limit(1);

      partner = userPartnerResult[0];
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

/**
 * Supplier procedure
 *
 * Accessible to users linked to a supplier (European wine suppliers) via:
 * 1. Member link (partnerMembers table) - PRIMARY source of truth
 * 2. Direct link (partners.userId) - owner access
 * 3. User's partnerId field - LEGACY fallback only
 *
 * Users must be explicitly linked to a supplier by an admin.
 * Injects the partnerId into the context for data isolation.
 */
export const supplierProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    const { eq, and } = await import('drizzle-orm');
    const { partners, partnerMembers } = await import('@/database/schema');

    let partner;

    // PRIMARY: Check partnerMembers table first (admin-assigned memberships)
    const membership = await db
      .select({ partner: partners })
      .from(partnerMembers)
      .innerJoin(partners, eq(partnerMembers.partnerId, partners.id))
      .where(
        and(
          eq(partnerMembers.userId, ctx.user.id),
          eq(partners.type, 'supplier'),
        ),
      )
      .limit(1);

    if (membership.length > 0 && membership[0]) {
      partner = membership[0].partner;
    }

    // FALLBACK 1: Check direct partner link (owner)
    if (!partner) {
      const directPartnerResult = await db
        .select()
        .from(partners)
        .where(
          and(
            eq(partners.userId, ctx.user.id),
            eq(partners.type, 'supplier'),
          ),
        )
        .limit(1);

      partner = directPartnerResult[0];
    }

    // FALLBACK 2: Check legacy user.partnerId field (deprecated)
    if (!partner && ctx.user.partnerId) {
      const userPartnerResult = await db
        .select()
        .from(partners)
        .where(
          and(
            eq(partners.id, ctx.user.partnerId),
            eq(partners.type, 'supplier'),
          ),
        )
        .limit(1);

      partner = userPartnerResult[0];
    }

    if (!partner) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message:
          'You are not linked to a supplier. Contact admin to be assigned.',
      });
    }

    if (partner.status !== 'active') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Your supplier account is not active',
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
 * Device procedure
 *
 * For warehouse devices (TC27, Enterprise Browser) that authenticate via
 * a pre-shared device token instead of user sessions.
 *
 * The device token is passed as an input parameter and validated against
 * the WMS_DEVICE_TOKEN environment variable.
 */
/**
 * Validates a device token against the expected WMS device token.
 * Call this from within your query/mutation handler after input is parsed.
 *
 * @throws TRPCError if token is invalid
 */
export const validateDeviceToken = (deviceToken: string | undefined) => {
  const expectedToken = serverConfig.wmsDeviceToken?.trim();

  if (!expectedToken) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Device authentication not configured',
    });
  }

  const trimmedToken = deviceToken?.trim();

  if (!trimmedToken || trimmedToken !== expectedToken) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Invalid device token',
    });
  }
};

/**
 * Device procedure - uses publicProcedure as base.
 * Token validation must be done in the query handler using validateDeviceToken().
 */
export const deviceProcedure = publicProcedure;
