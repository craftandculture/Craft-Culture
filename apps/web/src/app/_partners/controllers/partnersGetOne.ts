import { TRPCError } from '@trpc/server';
import { eq, sql } from 'drizzle-orm';
import z from 'zod';

import db from '@/database/client';
import { partnerApiKeys, partners, users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get a single partner by ID with related data
 *
 * Admin-only endpoint for viewing partner details
 */
const partnersGetOne = adminProcedure
  .input(z.object({ partnerId: z.string().uuid() }))
  .query(async ({ input }) => {
    const { partnerId } = input;

    const [partner] = await db
      .select({
        id: partners.id,
        userId: partners.userId,
        type: partners.type,
        status: partners.status,
        businessName: partners.businessName,
        businessAddress: partners.businessAddress,
        businessPhone: partners.businessPhone,
        businessEmail: partners.businessEmail,
        taxId: partners.taxId,
        commissionRate: partners.commissionRate,
        notes: partners.notes,
        metadata: partners.metadata,
        createdAt: partners.createdAt,
        updatedAt: partners.updatedAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(partners)
      .leftJoin(users, eq(partners.userId, users.id))
      .where(eq(partners.id, partnerId));

    if (!partner) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Partner not found',
      });
    }

    // Get API key count
    const [apiKeyStats] = await db
      .select({
        totalKeys: sql<number>`count(*)::int`,
        activeKeys: sql<number>`count(*) filter (where ${partnerApiKeys.isRevoked} = false)::int`,
      })
      .from(partnerApiKeys)
      .where(eq(partnerApiKeys.partnerId, partnerId));

    return {
      ...partner,
      apiKeyStats: {
        totalKeys: apiKeyStats?.totalKeys ?? 0,
        activeKeys: apiKeyStats?.activeKeys ?? 0,
      },
    };
  });

export type PartnersGetOneOutput = Awaited<ReturnType<typeof partnersGetOne>>;

export default partnersGetOne;
