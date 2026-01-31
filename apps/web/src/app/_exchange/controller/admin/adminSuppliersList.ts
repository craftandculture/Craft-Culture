import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { partners, supplierProducts, users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const inputSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  status: z.enum(['pending', 'active', 'suspended']).optional(),
  search: z.string().optional(),
});

/**
 * Get paginated list of suppliers (admin)
 *
 * Returns all supplier partners with their stats and status.
 * Supports filtering by status and search by name/email.
 *
 * @example
 *   const suppliers = await api.exchange.admin.suppliersList.query({
 *     page: 1,
 *     status: 'pending',
 *   });
 */
const adminSuppliersList = adminProcedure
  .input(inputSchema)
  .query(async ({ input }) => {
    const { page, limit, status, search } = input;
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [eq(partners.type, 'supplier')];

    if (status) {
      conditions.push(eq(partners.status, status));
    }

    if (search) {
      conditions.push(
        or(
          ilike(partners.businessName, `%${search}%`),
          ilike(partners.businessEmail, `%${search}%`),
        ) ?? sql`true`,
      );
    }

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(partners)
      .where(and(...conditions));

    const total = countResult?.count ?? 0;

    // Get suppliers with stats
    const suppliers = await db
      .select({
        id: partners.id,
        businessName: partners.businessName,
        businessEmail: partners.businessEmail,
        businessPhone: partners.businessPhone,
        businessAddress: partners.businessAddress,
        status: partners.status,
        commissionRate: partners.commissionRate,
        notes: partners.notes,
        createdAt: partners.createdAt,
        updatedAt: partners.updatedAt,
        ownerName: users.name,
        ownerEmail: users.email,
        productCount: sql<number>`(
          select count(distinct ${supplierProducts.productId})
          from ${supplierProducts}
          where ${supplierProducts.supplierId} = ${partners.id}
        )::int`,
        totalCases: sql<number>`(
          select coalesce(sum(${supplierProducts.casesAvailable}), 0)
          from ${supplierProducts}
          where ${supplierProducts.supplierId} = ${partners.id}
        )::int`,
      })
      .from(partners)
      .leftJoin(users, eq(partners.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(partners.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      items: suppliers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });

export default adminSuppliersList;
