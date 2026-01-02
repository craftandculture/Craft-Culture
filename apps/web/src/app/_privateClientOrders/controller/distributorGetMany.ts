import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';

import db from '@/database/client';
import { partners, privateClientContacts, privateClientOrders } from '@/database/schema';
import { distributorProcedure } from '@/lib/trpc/procedures';

import getOrdersSchema from '../schemas/getOrdersSchema';

/**
 * Get list of private client orders assigned to the current distributor
 *
 * Results are filtered by distributorId (data isolation) and support
 * pagination, search, and status filters.
 */
const distributorGetMany = distributorProcedure
  .input(getOrdersSchema)
  .query(async ({ input, ctx: { partnerId } }) => {
    const { limit, cursor, search, status } = input;

    // Build where conditions - always filter by distributorId for data isolation
    // Only show orders that have been approved and assigned to this distributor
    const conditions = [
      eq(privateClientOrders.distributorId, partnerId),
      // Distributors only see orders that are past CC approval
      inArray(privateClientOrders.status, [
        'cc_approved',
        'awaiting_partner_verification',
        'awaiting_distributor_verification',
        'verification_suspended',
        'awaiting_client_payment',
        'client_paid',
        'awaiting_distributor_payment',
        'distributor_paid',
        'awaiting_partner_payment',
        'partner_paid',
        'stock_in_transit',
        'with_distributor',
        'out_for_delivery',
        'delivered',
      ]),
    ];

    if (status) {
      conditions.push(eq(privateClientOrders.status, status));
    }

    if (search) {
      conditions.push(
        or(
          ilike(privateClientOrders.orderNumber, `%${search}%`),
          ilike(privateClientOrders.clientName, `%${search}%`),
          ilike(privateClientOrders.clientPhone, `%${search}%`),
        )!,
      );
    }

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(privateClientOrders)
      .where(and(...conditions));

    const totalCount = Number(countResult?.count ?? 0);

    // Get orders with partner and client info
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
      })
      .from(privateClientOrders)
      .leftJoin(partners, eq(privateClientOrders.partnerId, partners.id))
      .leftJoin(privateClientContacts, eq(privateClientOrders.clientId, privateClientContacts.id))
      .where(and(...conditions))
      .orderBy(desc(privateClientOrders.createdAt))
      .limit(limit)
      .offset(cursor);

    // Flatten the response
    const ordersWithPartner = ordersList.map((row) => ({
      ...row.order,
      partner: row.partner,
      client: row.client,
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

export default distributorGetMany;
