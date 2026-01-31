import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { partners, wmsLocations, wmsStock } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get a single warehouse location with stock details
 *
 * @example
 *   await trpcClient.wms.admin.locations.getOne.query({
 *     id: "uuid"
 *   });
 */
const adminGetLocation = adminProcedure
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ input }) => {
    const [location] = await db
      .select()
      .from(wmsLocations)
      .where(eq(wmsLocations.id, input.id))
      .limit(1);

    if (!location) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Location not found',
      });
    }

    // Get stock at this location
    const stock = await db
      .select({
        id: wmsStock.id,
        lwin18: wmsStock.lwin18,
        productName: wmsStock.productName,
        producer: wmsStock.producer,
        vintage: wmsStock.vintage,
        bottleSize: wmsStock.bottleSize,
        caseConfig: wmsStock.caseConfig,
        quantityCases: wmsStock.quantityCases,
        reservedCases: wmsStock.reservedCases,
        availableCases: wmsStock.availableCases,
        lotNumber: wmsStock.lotNumber,
        receivedAt: wmsStock.receivedAt,
        ownerId: wmsStock.ownerId,
        ownerName: wmsStock.ownerName,
        expiryDate: wmsStock.expiryDate,
        isPerishable: wmsStock.isPerishable,
        owner: {
          id: partners.id,
          businessName: partners.businessName,
        },
      })
      .from(wmsStock)
      .leftJoin(partners, eq(partners.id, wmsStock.ownerId))
      .where(eq(wmsStock.locationId, input.id));

    return {
      ...location,
      stock,
    };
  });

export default adminGetLocation;
