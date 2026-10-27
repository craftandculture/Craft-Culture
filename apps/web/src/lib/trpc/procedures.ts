import crypto from 'node:crypto';

import { TRPCError } from '@trpc/server';
import { cookies, headers } from 'next/headers';

import { STOCK_OWNER_PARTNER_TYPES } from '@/app/_auth/constants/accessProfiles';
import isTeamMember from '@/app/_teamTasks/utils/isTeamMember';
import db from '@/database/client';
import { WMS_DEVICE_COOKIE, WMS_DEVICE_HEADER } from '@/lib/wms/deviceTokenCookie';
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
 * Approved procedure
 *
 * Requires an authenticated user whose account has been APPROVED by an admin.
 * Use for shared business/catalog data endpoints so a merely-signed-up
 * (approvalStatus 'pending') account cannot read that data before approval.
 *
 * Deliberately NOT the base for onboarding/self-service endpoints (usersUpdate,
 * settings, notifications, usersGetMe) — those stay on `protectedProcedure` so a
 * pending user can still complete signup while awaiting approval.
 */
export const approvedProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.approvalStatus !== 'approved') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Your account is awaiting approval.',
    });
  }

  return next({ ctx });
});

/**
 * Admin procedure
 *
 * An admin on the C&C team: admin role AND a C&C email address. Role alone is
 * not enough — an admin login handed to a partner would otherwise reach every
 * client's data, costs and the user screens, where it could change a staff
 * member's email and sign in as them.
 *
 * @see https://trpc.io/docs/procedures
 */
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  ctx.accessControl(
    () => ctx.user.role === 'admin' && isTeamMember(ctx.user),
  );

  return await next({ ctx });
});

/**
 * WMS Operator procedure
 *
 * C&C staff with the admin or wms_operator role (a C&C email address is
 * required, as for adminProcedure). Use for WMS, Stock Explorer, and PCO
 * endpoints that warehouse operators need. Anything that changes prices,
 * ownership or deletes stock belongs on adminProcedure instead.
 */
export const wmsOperatorProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    ctx.accessControl(() => isTeamMember(ctx.user));

    return await next({ ctx });
  },
);

/**
 * Team procedure
 *
 * C&C staff only: admin or warehouse role AND a C&C email address. Used by
 * Team Tasks, which partners holding admin logins must never see.
 */
export const teamProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  ctx.accessControl(() => isTeamMember(ctx.user));

  return await next({ ctx });
});

/**
 * Staff admin procedure
 *
 * An admin who is also on the C&C team: admin role AND a C&C email address.
 * For screens holding members' identity documents, bank details and money —
 * the Private Cellar and consignment admin — which a partner holding an admin
 * login must never reach.
 */
export const staffAdminProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    ctx.accessControl(
      () => ctx.user.role === 'admin' && isTeamMember(ctx.user),
    );

    return await next({ ctx });
  },
);

/**
 * Partner task procedure
 *
 * For partner logins (wine partner, distributor or private collector) on the
 * jobs C&C has shared with their partner in Team Tasks. Injects the partnerId
 * so every read and write is limited to that partner's shared jobs.
 */
export const partnerTaskProcedure = approvedProcedure.use(
  async ({ ctx, next, type }) => {
    const { default: resolvePartnerForUser } = await import(
      '@/app/_partners/data/resolvePartnerForUser'
    );

    const partner = await resolvePartnerForUser(
      ctx.user.id,
      ['wine_partner', 'distributor', 'private_collector'],
      ctx.user.partnerId,
    );

    if (!partner || partner.status !== 'active') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You are not linked to an active partner account.',
      });
    }

    /*
      Someone a private cellar is shared with resolves to it through the same
      partner link, so the cellar's role rule applies here too: access that
      has ended is refused, and a viewer cannot tick or note a job.
    */
    if (partner.type === 'private_collector') {
      const { default: getCellarRole } = await import(
        '@/app/_cellar/data/getCellarRole'
      );

      const cellarRole = await getCellarRole(partner.id, ctx.user.id);

      if (cellarRole === 'revoked') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Your access to this private cellar has ended.',
        });
      }

      if (type === 'mutation' && cellarRole === 'viewer') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message:
            'You can view this private cellar, but only its holder or a manager can make changes.',
        });
      }
    }

    // A wine partner's view-only colleague cannot tick or note a job either
    if (partner.type === 'wine_partner' && type === 'mutation') {
      const { default: getPartnerMemberRole } = await import(
        '@/app/_partners/data/getPartnerMemberRole'
      );
      if ((await getPartnerMemberRole(partner.id, ctx.user.id)) === 'viewer') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message:
            'You have view-only access to this account. Ask its owner to change your access.',
        });
      }
    }

    return await next({
      ctx: { ...ctx, partner, partnerId: partner.id },
    });
  },
);

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
export const winePartnerProcedure = approvedProcedure.use(
  async ({ ctx, next, type }) => {
    const { default: resolvePartnerForUser } = await import(
      '@/app/_partners/data/resolvePartnerForUser'
    );

    const partner = await resolvePartnerForUser(
      ctx.user.id,
      ['wine_partner'],
      ctx.user.partnerId,
    );

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

    /*
      A partner can give a colleague view-only access. Held here, once, so a
      mutation added later is covered without anyone remembering to gate it.
    */
    const { default: getPartnerMemberRole } = await import(
      '@/app/_partners/data/getPartnerMemberRole'
    );
    const partnerRole = await getPartnerMemberRole(partner.id, ctx.user.id);

    if (type === 'mutation' && partnerRole === 'viewer') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message:
          'You have view-only access to this account. Ask its owner to change your access.',
      });
    }

    return await next({
      ctx: { ...ctx, partner, partnerId: partner.id, partnerRole },
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
export const distributorProcedure = approvedProcedure.use(
  async ({ ctx, next }) => {
    const { default: resolvePartnerForUser } = await import(
      '@/app/_partners/data/resolvePartnerForUser'
    );

    const partner = await resolvePartnerForUser(
      ctx.user.id,
      ['distributor'],
      ctx.user.partnerId,
    );

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
      ctx: { ...ctx, partner, partnerId: partner.id },
    });
  },
);

/**
 * Stock-owner procedure
 *
 * For any partner whose wine physically sits in the warehouse — a wine partner
 * or a private collector. Distributors are deliberately excluded: they fulfil
 * orders, they do not own stock, so nothing here would be theirs to see.
 */
export const stockOwnerProcedure = approvedProcedure.use(
  async ({ ctx, next, type, path }) => {
    /*
      An account awaiting approval holds nothing yet. Only the page redirect
      stopped a pending user who was already linked to a partner from calling
      these procedures directly, so the rule is held here as well.
    */
    if (ctx.user.approvalStatus !== 'approved') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Your account is awaiting approval.',
      });
    }

    const { default: resolvePartnerForUser } = await import(
      '@/app/_partners/data/resolvePartnerForUser'
    );

    const partner = await resolvePartnerForUser(
      ctx.user.id,
      [...STOCK_OWNER_PARTNER_TYPES],
      ctx.user.partnerId,
    );

    if (!partner) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message:
          'You are not linked to an account holding stock. Contact admin to be assigned.',
      });
    }

    if (partner.status !== 'active') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Your account is not active',
      });
    }

    /*
      A private cellar can be shared with a spouse or PA. Who they are to it
      is decided here, once, for every stock-owner call, so a mutation added
      later is covered without anyone remembering to gate it: a viewer can
      never commit to anything, and access that has been revoked ends on the
      very next request. Holder-only actions additionally use
      cellarHolderProcedure. Other stock owners (wine partners) cannot share
      access, so they are always the holder.
    */
    const { default: getCellarRole } = await import(
      '@/app/_cellar/data/getCellarRole'
    );

    const cellarRole =
      partner.type === 'private_collector'
        ? await getCellarRole(partner.id, ctx.user.id)
        : ('holder' as const);

    // A wine partner's view-only colleague, the same rule as winePartnerProcedure
    if (partner.type === 'wine_partner' && type === 'mutation') {
      const { default: getPartnerMemberRole } = await import(
        '@/app/_partners/data/getPartnerMemberRole'
      );
      if ((await getPartnerMemberRole(partner.id, ctx.user.id)) === 'viewer') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message:
            'You have view-only access to this account. Ask its owner to change your access.',
        });
      }
    }

    if (cellarRole === 'revoked') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Your access to this private cellar has ended.',
      });
    }

    if (type === 'mutation' && cellarRole === 'viewer') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message:
          'You can view this private cellar, but only its holder or a manager can make changes.',
      });
    }

    const result = await next({
      ctx: { ...ctx, partner, partnerId: partner.id, cellarRole },
    });

    /*
      The holder hears about anything a manager commits them to. Their own
      actions, and anything that failed, say nothing.
    */
    if (type === 'mutation' && cellarRole === 'manager' && result.ok) {
      const [{ default: notifyCellarHolder }, { default: describeDelegateAction }] =
        await Promise.all([
          import('@/app/_cellar/data/notifyCellarHolder'),
          import('@/app/_cellar/utils/describeDelegateAction'),
        ]);

      const who = ctx.user.name || ctx.user.email;

      await notifyCellarHolder({
        partnerId: partner.id,
        title: `${who} ${describeDelegateAction(path)}`,
        message: `${who} has access to your private cellar as a manager and ${describeDelegateAction(path)} on your behalf.`,
      });
    }

    return result;
  },
);

/**
 * Cellar-holder procedure
 *
 * For a private cellar holder's own affairs: identity documents, contact
 * details, the membership and who else has access. Someone the cellar is
 * shared with — even a manager — is refused.
 */
export const cellarHolderProcedure = stockOwnerProcedure.use(
  async ({ ctx, next }) => {
    if (ctx.cellarRole !== 'holder') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only the holder of this private cellar can do this.',
      });
    }

    return await next();
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
export const supplierProcedure = approvedProcedure.use(
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
 * The device token is sent as a header or cookie and validated against the
 * WMS_DEVICE_TOKEN environment variable.
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

  const a = Buffer.from(trimmedToken ?? '');
  const b = Buffer.from(expectedToken);
  const tokenValid =
    !!trimmedToken && a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!tokenValid) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Invalid device token',
    });
  }
};

/**
 * Device procedure
 *
 * Fails closed: every call must present the device token, either in the
 * `x-device-token` header or the httpOnly cookie middleware sets when a
 * device opens its WMS link. Tokens in the request input are not accepted.
 */
export const deviceProcedure = publicProcedure.use(async ({ next }) => {
  const [headerList, cookieStore] = await Promise.all([headers(), cookies()]);
  const presented =
    headerList.get(WMS_DEVICE_HEADER) ??
    cookieStore.get(WMS_DEVICE_COOKIE)?.value;

  validateDeviceToken(presented ?? undefined);

  return next();
});
