import { desc, eq, gte, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsShipmentItems, logisticsShipments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const getLandedCostReportSchema = z.object({
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  partnerId: z.string().uuid().optional(),
  transportMode: z.enum(['sea_fcl', 'sea_lcl', 'air', 'road']).optional(),
});

/**
 * Get landed cost analysis report
 *
 * Provides detailed cost breakdown per shipment and per product,
 * with aggregated summaries for analysis.
 */
const adminGetLandedCostReport = adminProcedure
  .input(getLandedCostReportSchema)
  .query(async ({ input }) => {
    const { dateFrom, dateTo, partnerId, transportMode } = input;

    // Build where conditions
    const conditions = [];

    // Only include delivered shipments for accurate cost analysis
    conditions.push(eq(logisticsShipments.status, 'delivered'));

    if (dateFrom) {
      conditions.push(gte(logisticsShipments.deliveredAt, dateFrom));
    }

    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setDate(endDate.getDate() + 1);
      conditions.push(sql`${logisticsShipments.deliveredAt} < ${endDate}`);
    }

    if (partnerId) {
      conditions.push(eq(logisticsShipments.partnerId, partnerId));
    }

    if (transportMode) {
      conditions.push(eq(logisticsShipments.transportMode, transportMode));
    }

    // Get shipments with their items
    const shipments = await db.query.logisticsShipments.findMany({
      where: conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : undefined,
      with: {
        partner: {
          columns: {
            id: true,
            businessName: true,
          },
        },
      },
      columns: {
        id: true,
        shipmentNumber: true,
        shipmentType: true,
        transportMode: true,
        originCountry: true,
        originCity: true,
        destinationCountry: true,
        destinationCity: true,
        totalCases: true,
        totalBottles: true,
        totalGrossWeight: true,
        freightCost: true,
        insuranceCost: true,
        originHandlingCost: true,
        destinationHandlingCost: true,
        customsClearanceCost: true,
        governmentFees: true,
        deliveryCost: true,
        otherCosts: true,
        costAllocationMethod: true,
        deliveredAt: true,
      },
      orderBy: desc(logisticsShipments.deliveredAt),
    });

    // Get items for all shipments
    const shipmentIds = shipments.map((s) => s.id);
    const items =
      shipmentIds.length > 0
        ? await db.query.logisticsShipmentItems.findMany({
            where: or(...shipmentIds.map((id) => eq(logisticsShipmentItems.shipmentId, id))),
            columns: {
              id: true,
              shipmentId: true,
              productName: true,
              productSku: true,
              cases: true,
              bottlesPerCase: true,
              totalBottles: true,
              productCost: true,
              declaredValue: true,
              grossWeight: true,
              allocatedFreightCost: true,
              allocatedHandlingCost: true,
              allocatedGovFees: true,
              allocatedInsuranceCost: true,
              targetSellingPrice: true,
              marginPerBottle: true,
              marginPercentage: true,
            },
          })
        : [];

    // Build shipment cost summaries
    const shipmentSummaries = shipments.map((shipment) => {
      const shipmentItems = items.filter((i) => i.shipmentId === shipment.id);

      const totalShipmentCost =
        (shipment.freightCost || 0) +
        (shipment.insuranceCost || 0) +
        (shipment.originHandlingCost || 0) +
        (shipment.destinationHandlingCost || 0) +
        (shipment.customsClearanceCost || 0) +
        (shipment.governmentFees || 0) +
        (shipment.deliveryCost || 0) +
        (shipment.otherCosts || 0);

      const totalProductCost = shipmentItems.reduce(
        (sum, item) => sum + (item.productCost || 0),
        0,
      );

      const totalLandedCost = totalProductCost + totalShipmentCost;
      const costPerBottle =
        shipment.totalBottles && shipment.totalBottles > 0
          ? totalLandedCost / shipment.totalBottles
          : 0;

      return {
        shipmentId: shipment.id,
        shipmentNumber: shipment.shipmentNumber,
        shipmentType: shipment.shipmentType,
        transportMode: shipment.transportMode,
        route: `${shipment.originCity || shipment.originCountry || 'Unknown'} → ${shipment.destinationCity || shipment.destinationCountry || 'Unknown'}`,
        partner: shipment.partner?.businessName || 'N/A',
        deliveredAt: shipment.deliveredAt,
        cases: shipment.totalCases || 0,
        bottles: shipment.totalBottles || 0,
        weight: shipment.totalGrossWeight || 0,
        costs: {
          product: totalProductCost,
          freight: shipment.freightCost || 0,
          insurance: shipment.insuranceCost || 0,
          handling: (shipment.originHandlingCost || 0) + (shipment.destinationHandlingCost || 0),
          customs: shipment.customsClearanceCost || 0,
          governmentFees: shipment.governmentFees || 0,
          delivery: shipment.deliveryCost || 0,
          other: shipment.otherCosts || 0,
          totalShipping: totalShipmentCost,
          totalLanded: totalLandedCost,
          perBottle: Math.round(costPerBottle * 100) / 100,
        },
        costAllocationMethod: shipment.costAllocationMethod,
        itemCount: shipmentItems.length,
      };
    });

    // Product-level analysis
    const productCosts: Record<
      string,
      {
        productName: string;
        productSku: string | null;
        totalBottles: number;
        totalCost: number;
        avgCostPerBottle: number;
        shipmentCount: number;
        avgMarginPercentage: number;
      }
    > = {};

    for (const item of items) {
      const key = item.productSku || item.productName;
      if (!productCosts[key]) {
        productCosts[key] = {
          productName: item.productName,
          productSku: item.productSku,
          totalBottles: 0,
          totalCost: 0,
          avgCostPerBottle: 0,
          shipmentCount: 0,
          avgMarginPercentage: 0,
        };
      }

      const itemTotalCost =
        (item.productCost || 0) +
        (item.allocatedFreightCost || 0) +
        (item.allocatedHandlingCost || 0) +
        (item.allocatedGovFees || 0) +
        (item.allocatedInsuranceCost || 0);

      productCosts[key].totalBottles += item.totalBottles || 0;
      productCosts[key].totalCost += itemTotalCost;
      productCosts[key].shipmentCount += 1;
      if (item.marginPercentage) {
        productCosts[key].avgMarginPercentage =
          (productCosts[key].avgMarginPercentage * (productCosts[key].shipmentCount - 1) +
            item.marginPercentage) /
          productCosts[key].shipmentCount;
      }
    }

    // Calculate average cost per bottle for each product
    const productSummaries = Object.values(productCosts)
      .map((p) => ({
        ...p,
        avgCostPerBottle: p.totalBottles > 0 ? Math.round((p.totalCost / p.totalBottles) * 100) / 100 : 0,
        avgMarginPercentage: Math.round(p.avgMarginPercentage * 100) / 100,
      }))
      .sort((a, b) => b.totalCost - a.totalCost);

    // Transport mode analysis
    const transportModeAnalysis: Record<
      string,
      { shipmentCount: number; totalCost: number; totalBottles: number; avgCostPerBottle: number }
    > = {};

    for (const shipment of shipmentSummaries) {
      const mode = shipment.transportMode;
      if (!transportModeAnalysis[mode]) {
        transportModeAnalysis[mode] = {
          shipmentCount: 0,
          totalCost: 0,
          totalBottles: 0,
          avgCostPerBottle: 0,
        };
      }
      transportModeAnalysis[mode].shipmentCount += 1;
      transportModeAnalysis[mode].totalCost += shipment.costs.totalLanded;
      transportModeAnalysis[mode].totalBottles += shipment.bottles;
    }

    // Calculate averages for transport modes
    for (const mode of Object.keys(transportModeAnalysis)) {
      const data = transportModeAnalysis[mode];
      data.avgCostPerBottle =
        data.totalBottles > 0 ? Math.round((data.totalCost / data.totalBottles) * 100) / 100 : 0;
    }

    // Overall summary
    const summary = {
      totalShipments: shipmentSummaries.length,
      totalBottles: shipmentSummaries.reduce((sum, s) => sum + s.bottles, 0),
      totalCases: shipmentSummaries.reduce((sum, s) => sum + s.cases, 0),
      totalProductCost: shipmentSummaries.reduce((sum, s) => sum + s.costs.product, 0),
      totalShippingCost: shipmentSummaries.reduce((sum, s) => sum + s.costs.totalShipping, 0),
      totalLandedCost: shipmentSummaries.reduce((sum, s) => sum + s.costs.totalLanded, 0),
      averageCostPerBottle:
        shipmentSummaries.reduce((sum, s) => sum + s.bottles, 0) > 0
          ? Math.round(
              (shipmentSummaries.reduce((sum, s) => sum + s.costs.totalLanded, 0) /
                shipmentSummaries.reduce((sum, s) => sum + s.bottles, 0)) *
                100,
            ) / 100
          : 0,
      costBreakdown: {
        freight: shipmentSummaries.reduce((sum, s) => sum + s.costs.freight, 0),
        insurance: shipmentSummaries.reduce((sum, s) => sum + s.costs.insurance, 0),
        handling: shipmentSummaries.reduce((sum, s) => sum + s.costs.handling, 0),
        customs: shipmentSummaries.reduce((sum, s) => sum + s.costs.customs, 0),
        governmentFees: shipmentSummaries.reduce((sum, s) => sum + s.costs.governmentFees, 0),
        delivery: shipmentSummaries.reduce((sum, s) => sum + s.costs.delivery, 0),
        other: shipmentSummaries.reduce((sum, s) => sum + s.costs.other, 0),
      },
    };

    return {
      summary,
      shipments: shipmentSummaries,
      products: productSummaries,
      byTransportMode: transportModeAnalysis,
    };
  });

export default adminGetLandedCostReport;
