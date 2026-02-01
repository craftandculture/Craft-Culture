import { and, desc, eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { partners, users, wmsLocations, wmsPartnerRequests, wmsStock } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { getPartnerRequestsSchema } from '../schemas/ownershipSchema';

/**
 * Get partner requests with filtering and pagination
 * Returns requests from partners for transfers, withdrawals, or marking stock for sale
 *
 * @example
 *   await trpcClient.wms.admin.ownership.getRequests.query({
 *     status: "pending",
 *     limit: 50
 *   });
 */
const adminGetPartnerRequests = adminProcedure
  .input(getPartnerRequestsSchema)
  .query(async ({ input }) => {
    const { status, partnerId, requestType, limit, offset } = input;

    const conditions = [];

    if (status) {
      conditions.push(eq(wmsPartnerRequests.status, status));
    }

    if (partnerId) {
      conditions.push(eq(wmsPartnerRequests.partnerId, partnerId));
    }

    if (requestType) {
      conditions.push(eq(wmsPartnerRequests.requestType, requestType));
    }

    // Get requests with partner and user info
    const requests = await db
      .select({
        id: wmsPartnerRequests.id,
        requestNumber: wmsPartnerRequests.requestNumber,
        requestType: wmsPartnerRequests.requestType,
        status: wmsPartnerRequests.status,
        partnerId: wmsPartnerRequests.partnerId,
        partnerName: partners.businessName,
        requestedById: wmsPartnerRequests.requestedBy,
        requestedByName: users.name,
        requestedByEmail: users.email,
        requestedAt: wmsPartnerRequests.requestedAt,
        stockId: wmsPartnerRequests.stockId,
        lwin18: wmsPartnerRequests.lwin18,
        productName: wmsPartnerRequests.productName,
        quantityCases: wmsPartnerRequests.quantityCases,
        targetLocationId: wmsPartnerRequests.targetLocationId,
        targetLocationCode: wmsLocations.locationCode,
        partnerNotes: wmsPartnerRequests.partnerNotes,
        adminNotes: wmsPartnerRequests.adminNotes,
        resolvedAt: wmsPartnerRequests.resolvedAt,
        createdAt: wmsPartnerRequests.createdAt,
      })
      .from(wmsPartnerRequests)
      .leftJoin(partners, eq(partners.id, wmsPartnerRequests.partnerId))
      .leftJoin(users, eq(users.id, wmsPartnerRequests.requestedBy))
      .leftJoin(wmsLocations, eq(wmsLocations.id, wmsPartnerRequests.targetLocationId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(wmsPartnerRequests.createdAt))
      .limit(limit)
      .offset(offset);

    // Enrich with current stock info if stockId exists
    const enrichedRequests = await Promise.all(
      requests.map(async (req) => {
        let currentStock = null;
        if (req.stockId) {
          const [stock] = await db
            .select({
              quantityCases: wmsStock.quantityCases,
              availableCases: wmsStock.availableCases,
              locationCode: wmsLocations.locationCode,
            })
            .from(wmsStock)
            .leftJoin(wmsLocations, eq(wmsLocations.id, wmsStock.locationId))
            .where(eq(wmsStock.id, req.stockId));
          currentStock = stock;
        }

        return {
          ...req,
          currentStock,
          requestedBy: {
            id: req.requestedById,
            name: req.requestedByName,
            email: req.requestedByEmail,
          },
        };
      }),
    );

    // Get total count
    const [countResult] = await db
      .select({
        count: sql<number>`COUNT(*)::int`,
      })
      .from(wmsPartnerRequests)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // Get summary by status
    const statusSummary = await db
      .select({
        status: wmsPartnerRequests.status,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(wmsPartnerRequests)
      .groupBy(wmsPartnerRequests.status);

    return {
      requests: enrichedRequests,
      pagination: {
        total: countResult?.count ?? 0,
        limit,
        offset,
        hasMore: offset + requests.length < (countResult?.count ?? 0),
      },
      summary: {
        byStatus: statusSummary,
        pendingCount: statusSummary.find((s) => s.status === 'pending')?.count ?? 0,
      },
    };
  });

export default adminGetPartnerRequests;
