import { desc, eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { wmsLocations, wmsPallets } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { getPalletsSchema } from '../schemas/palletSchema';

/**
 * List pallets with optional filters
 *
 * @example
 *   await trpcClient.wms.admin.pallets.getMany.query({
 *     status: "active",
 *     limit: 50
 *   });
 */
const adminGetPallets = adminProcedure.input(getPalletsSchema).query(async ({ input }) => {
  const { status, ownerId, limit } = input;

  // Build where conditions
  const conditions = [];
  if (status) {
    conditions.push(eq(wmsPallets.status, status));
  }
  if (ownerId) {
    conditions.push(eq(wmsPallets.ownerId, ownerId));
  }

  // Query pallets
  const pallets = await db
    .select({
      id: wmsPallets.id,
      palletCode: wmsPallets.palletCode,
      barcode: wmsPallets.barcode,
      ownerId: wmsPallets.ownerId,
      ownerName: wmsPallets.ownerName,
      locationId: wmsPallets.locationId,
      locationCode: wmsLocations.locationCode,
      totalCases: wmsPallets.totalCases,
      storageType: wmsPallets.storageType,
      status: wmsPallets.status,
      isSealed: wmsPallets.isSealed,
      sealedAt: wmsPallets.sealedAt,
      createdAt: wmsPallets.createdAt,
    })
    .from(wmsPallets)
    .leftJoin(wmsLocations, eq(wmsPallets.locationId, wmsLocations.id))
    .where(conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : undefined)
    .orderBy(desc(wmsPallets.createdAt))
    .limit(limit || 50);

  // Get counts by status
  const statusCounts = await db
    .select({
      status: wmsPallets.status,
      count: sql<number>`count(*)::integer`,
    })
    .from(wmsPallets)
    .groupBy(wmsPallets.status);

  const counts = statusCounts.reduce(
    (acc, { status, count }) => {
      if (status) acc[status] = count;
      return acc;
    },
    { active: 0, sealed: 0, retrieved: 0, archived: 0 } as Record<string, number>,
  );

  return {
    pallets,
    totalPallets: pallets.length,
    counts,
  };
});

export default adminGetPallets;
