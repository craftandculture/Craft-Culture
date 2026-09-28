import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';

import db from '@/database/client';
import {
  partners,
  privateClientContacts,
  privateClientOrders,
} from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { privateClientOrderStatusEnum } from '../schemas/getOrdersSchema';

const adminGetOrdersSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  cursor: z.number().default(0),
  search: z.string().optional(),
  status: privateClientOrderStatusEnum.optional(),
  partnerId: z.string().uuid().optional(),
  /** A distributor's orders, or 'unassigned' for orders with none */
  distributor: z.union([z.literal('unassigned'), z.string().uuid()]).optional(),
  /** One subscription box; a null variant means the box with no variant */
  box: z
    .object({
      tier: z.string(),
      caseSize: z.number().int().nullable(),
      variant: z.string().nullable(),
    })
    .optional(),
});

/**
 * Get all private client orders for admin view
 *
 * Admins can see all orders across all partners with filtering options.
 */
/** The order's distributor, joined alongside its partner */
const distributorPartner = alias(partners, 'distributor_partner');

const adminGetMany = wmsOperatorProcedure
  .input(adminGetOrdersSchema)
  .query(async ({ input }) => {
    const { limit, cursor, search, status, partnerId, box, distributor } = input;

    // Build where conditions
    const conditions = [];

    if (status) {
      conditions.push(eq(privateClientOrders.status, status));
    }

    if (partnerId) {
      conditions.push(eq(privateClientOrders.partnerId, partnerId));
    }

    if (distributor) {
      conditions.push(
        distributor === 'unassigned'
          ? isNull(privateClientOrders.distributorId)
          : eq(privateClientOrders.distributorId, distributor),
      );
    }

    if (box) {
      conditions.push(
        eq(privateClientOrders.subscriptionTier, box.tier),
        box.caseSize === null
          ? isNull(privateClientOrders.subscriptionCaseSize)
          : eq(privateClientOrders.subscriptionCaseSize, box.caseSize),
        box.variant === null
          ? isNull(privateClientOrders.subscriptionVariant)
          : eq(privateClientOrders.subscriptionVariant, box.variant),
      );
    }

    if (search) {
      conditions.push(
        or(
          ilike(privateClientOrders.orderNumber, `%${search}%`),
          ilike(privateClientOrders.clientName, `%${search}%`),
          ilike(privateClientOrders.clientEmail, `%${search}%`),
        )!,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(privateClientOrders)
      .where(whereClause);

    const totalCount = Number(countResult?.count ?? 0);

    // Get orders with pagination, including partner and client info
    const ordersList = await db
      .select({
        order: privateClientOrders,
        partner: {
          id: partners.id,
          businessName: partners.businessName,
          logoUrl: partners.logoUrl,
        },
        client: {
          id: privateClientContacts.id,
          cityDrinksVerifiedAt: privateClientContacts.cityDrinksVerifiedAt,
        },
        distributor: {
          id: distributorPartner.id,
          businessName: distributorPartner.businessName,
        },
      })
      .from(privateClientOrders)
      .leftJoin(partners, eq(privateClientOrders.partnerId, partners.id))
      .leftJoin(
        distributorPartner,
        eq(privateClientOrders.distributorId, distributorPartner.id),
      )
      .leftJoin(
        privateClientContacts,
        eq(privateClientOrders.clientId, privateClientContacts.id),
      )
      .where(whereClause)
      .orderBy(desc(privateClientOrders.createdAt))
      .limit(limit)
      .offset(cursor);

    // Flatten the response
    const ordersWithPartner = ordersList.map((row) => ({
      ...row.order,
      partner: row.partner,
      client: row.client,
      distributor: row.distributor?.id ? row.distributor : null,
    }));

    const nextCursor = cursor + limit < totalCount ? cursor + limit : null;

    return {
      data: ordersWithPartner,
      meta: {
        totalCount,
        nextCursor,
        hasMore: nextCursor !== null,
      },
    };
  });

export default adminGetMany;
