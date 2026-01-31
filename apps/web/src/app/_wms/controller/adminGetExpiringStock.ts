import { and, asc, eq, lte, sql } from 'drizzle-orm';

import db from '@/database/client';
import { wmsLocations, wmsStock } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { getExpiringStockSchema } from '../schemas/stockQuerySchema';

/**
 * Get expiring stock for FEFO (First Expiry First Out) alerts
 * Groups stock by expiry status: expired, critical (<30 days), warning (<90 days)
 *
 * @example
 *   await trpcClient.wms.admin.stock.getExpiring.query({
 *     daysThreshold: 90,
 *     includeExpired: true
 *   });
 */
const adminGetExpiringStock = adminProcedure
  .input(getExpiringStockSchema)
  .query(async ({ input }) => {
    const { daysThreshold, includeExpired } = input;

    const now = new Date();
    const thresholdDate = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const conditions = [
      eq(wmsStock.isPerishable, true),
      sql`${wmsStock.expiryDate} IS NOT NULL`,
    ];

    if (!includeExpired) {
      conditions.push(sql`${wmsStock.expiryDate} >= NOW()`);
    }

    conditions.push(lte(wmsStock.expiryDate, thresholdDate));

    // Get all expiring stock with location info
    const expiringStock = await db
      .select({
        id: wmsStock.id,
        lwin18: wmsStock.lwin18,
        productName: wmsStock.productName,
        producer: wmsStock.producer,
        vintage: wmsStock.vintage,
        caseConfig: wmsStock.caseConfig,
        quantityCases: wmsStock.quantityCases,
        availableCases: wmsStock.availableCases,
        expiryDate: wmsStock.expiryDate,
        lotNumber: wmsStock.lotNumber,
        ownerId: wmsStock.ownerId,
        ownerName: wmsStock.ownerName,
        locationId: wmsStock.locationId,
        locationCode: wmsLocations.locationCode,
        locationType: wmsLocations.locationType,
      })
      .from(wmsStock)
      .innerJoin(wmsLocations, eq(wmsLocations.id, wmsStock.locationId))
      .where(and(...conditions))
      .orderBy(asc(wmsStock.expiryDate));

    // Categorize by expiry status
    const expired: typeof expiringStock = [];
    const critical: typeof expiringStock = []; // < 30 days
    const warning: typeof expiringStock = []; // 30-90 days

    expiringStock.forEach((stock) => {
      if (!stock.expiryDate) return;

      if (stock.expiryDate < now) {
        expired.push(stock);
      } else if (stock.expiryDate <= thirtyDays) {
        critical.push(stock);
      } else {
        warning.push(stock);
      }
    });

    // Calculate totals
    const summary = {
      expiredCases: expired.reduce((sum, s) => sum + s.quantityCases, 0),
      expiredProducts: new Set(expired.map((s) => s.lwin18)).size,
      criticalCases: critical.reduce((sum, s) => sum + s.quantityCases, 0),
      criticalProducts: new Set(critical.map((s) => s.lwin18)).size,
      warningCases: warning.reduce((sum, s) => sum + s.quantityCases, 0),
      warningProducts: new Set(warning.map((s) => s.lwin18)).size,
      totalExpiringCases:
        expired.reduce((sum, s) => sum + s.quantityCases, 0) +
        critical.reduce((sum, s) => sum + s.quantityCases, 0) +
        warning.reduce((sum, s) => sum + s.quantityCases, 0),
    };

    // Group by product for easier display
    const groupByProduct = (items: typeof expiringStock) => {
      const grouped = new Map<
        string,
        {
          lwin18: string;
          productName: string;
          producer: string | null;
          vintage: number | null;
          totalCases: number;
          earliestExpiry: Date | null;
          locations: Array<{
            locationCode: string;
            quantityCases: number;
            expiryDate: Date | null;
            ownerName: string;
            lotNumber: string | null;
          }>;
        }
      >();

      items.forEach((item) => {
        const existing = grouped.get(item.lwin18);
        if (existing) {
          existing.totalCases += item.quantityCases;
          if (item.expiryDate && (!existing.earliestExpiry || item.expiryDate < existing.earliestExpiry)) {
            existing.earliestExpiry = item.expiryDate;
          }
          existing.locations.push({
            locationCode: item.locationCode,
            quantityCases: item.quantityCases,
            expiryDate: item.expiryDate,
            ownerName: item.ownerName,
            lotNumber: item.lotNumber,
          });
        } else {
          grouped.set(item.lwin18, {
            lwin18: item.lwin18,
            productName: item.productName,
            producer: item.producer,
            vintage: item.vintage,
            totalCases: item.quantityCases,
            earliestExpiry: item.expiryDate,
            locations: [
              {
                locationCode: item.locationCode,
                quantityCases: item.quantityCases,
                expiryDate: item.expiryDate,
                ownerName: item.ownerName,
                lotNumber: item.lotNumber,
              },
            ],
          });
        }
      });

      return Array.from(grouped.values());
    };

    return {
      summary,
      expired: groupByProduct(expired),
      critical: groupByProduct(critical),
      warning: groupByProduct(warning),
      raw: {
        expired,
        critical,
        warning,
      },
    };
  });

export default adminGetExpiringStock;
