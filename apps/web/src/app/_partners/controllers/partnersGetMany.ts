import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import z from 'zod';

import db from '@/database/client';
import { partnerApiKeys, partners, users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get paginated list of partners with filtering and search
 *
 * Admin-only endpoint for partner management
 */
const partnersGetMany = adminProcedure
  .input(
    z.object({
      cursor: z.number().optional().default(0),
      limit: z.number().optional().default(50),
      type: z.enum(['retailer', 'sommelier', 'distributor']).optional(),
      status: z.enum(['active', 'inactive', 'suspended']).optional(),
      search: z.string().optional(),
    }),
  )
  .query(async ({ input }) => {
    const { cursor, limit, type, status, search } = input;

    const whereConditions = [];

    if (type) {
      whereConditions.push(eq(partners.type, type));
    }

    if (status) {
      whereConditions.push(eq(partners.status, status));
    }

    if (search && search.trim().length > 0) {
      const searchTerm = `%${search.trim()}%`;
      whereConditions.push(
        or(
          ilike(partners.businessName, searchTerm),
          ilike(partners.businessEmail, searchTerm),
        ),
      );
    }

    const whereClause =
      whereConditions.length > 0
        ? sql`${sql.join(whereConditions, sql` AND `)}`
        : undefined;

    const partnersResult = await db
      .select({
        id: partners.id,
        userId: partners.userId,
        type: partners.type,
        status: partners.status,
        businessName: partners.businessName,
        businessAddress: partners.businessAddress,
        businessEmail: partners.businessEmail,
        businessPhone: partners.businessPhone,
        taxId: partners.taxId,
        commissionRate: partners.commissionRate,
        logoUrl: partners.logoUrl,
        paymentMethod: partners.paymentMethod,
        paymentDetails: partners.paymentDetails,
        createdAt: partners.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(partners)
      .leftJoin(users, eq(partners.userId, users.id))
      .where(whereClause)
      .orderBy(desc(partners.createdAt))
      .limit(limit + 1)
      .offset(cursor);

    // Fetch API keys for all partners
    const partnerIds = partnersResult.map((p) => p.id);
    const apiKeys =
      partnerIds.length > 0
        ? await db
            .select({
              id: partnerApiKeys.id,
              partnerId: partnerApiKeys.partnerId,
              name: partnerApiKeys.name,
              keyPrefix: partnerApiKeys.keyPrefix,
              isRevoked: partnerApiKeys.isRevoked,
              createdAt: partnerApiKeys.createdAt,
            })
            .from(partnerApiKeys)
            .where(
              and(
                sql`${partnerApiKeys.partnerId} IN ${partnerIds}`,
                eq(partnerApiKeys.isRevoked, false),
              ),
            )
            .orderBy(desc(partnerApiKeys.createdAt))
        : [];

    // Group API keys by partner
    const apiKeysByPartner = apiKeys.reduce(
      (acc, key) => {
        if (!acc[key.partnerId]) {
          acc[key.partnerId] = [];
        }
        acc[key.partnerId]!.push(key);
        return acc;
      },
      {} as Record<string, typeof apiKeys>,
    );

    // Transform results to include user object and API keys
    const transformedData = partnersResult.slice(0, limit).map((p) => ({
      id: p.id,
      userId: p.userId,
      type: p.type,
      status: p.status,
      businessName: p.businessName,
      businessAddress: p.businessAddress,
      businessEmail: p.businessEmail,
      businessPhone: p.businessPhone,
      taxId: p.taxId,
      commissionRate: p.commissionRate,
      logoUrl: p.logoUrl,
      paymentMethod: p.paymentMethod,
      paymentDetails: p.paymentDetails as {
        bankName?: string;
        accountName?: string;
        accountNumber?: string;
        sortCode?: string;
        iban?: string;
        swiftBic?: string;
        reference?: string;
        paymentUrl?: string;
      } | null,
      createdAt: p.createdAt,
      user: {
        name: p.userName ?? 'Unknown',
        email: p.userEmail ?? '',
      },
      apiKeys: apiKeysByPartner[p.id] ?? [],
      apiKeyCount: (apiKeysByPartner[p.id] ?? []).length,
    }));

    return transformedData;
  });

export type PartnersGetManyOutput = Awaited<ReturnType<typeof partnersGetMany>>;

export default partnersGetMany;
