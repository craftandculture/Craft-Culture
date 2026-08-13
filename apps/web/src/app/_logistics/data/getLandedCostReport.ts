import db from '@/database/client';

import type { LandedCostReportInput } from '../schemas/landedCostSchemas';

/**
 * Build the landed cost analysis: per shipment, per product and by transport mode.
 *
 * Lives here rather than in the tRPC controller because the Excel export needs
 * the same figures. It previously reached into the procedure's internals
 * (`_def.query`), which no longer exists in this tRPC version and threw at
 * runtime — both callers now share this function instead.
 *
 * @param input - Date, partner and transport-mode filters
 * @returns Summary, per-shipment, per-product and per-transport-mode breakdowns
 */
const getLandedCostReport = async (input: LandedCostReportInput) => {
  const { dateFrom, dateTo, partnerId, transportMode } = input;

  // dateTo is inclusive, so compare against the start of the following day
  const deliveredBefore = dateTo ? new Date(dateTo) : undefined;
  if (deliveredBefore) {
    deliveredBefore.setDate(deliveredBefore.getDate() + 1);
  }

  // Only delivered shipments give an accurate landed cost
  const deliveredAt =
    dateFrom || deliveredBefore
      ? {
          ...(dateFrom ? { gte: dateFrom } : {}),
          ...(deliveredBefore ? { lt: deliveredBefore } : {}),
        }
      : undefined;

  // Get shipments with their items
  const shipments = await db.query.logisticsShipments.findMany({
    where: {
      status: 'delivered',
      ...(deliveredAt ? { deliveredAt } : {}),
      ...(partnerId ? { partnerId } : {}),
      ...(transportMode ? { transportMode } : {}),
    },
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
      type: true,
      transportMode: true,
      originCountry: true,
      originCity: true,
      destinationCountry: true,
      destinationCity: true,
      totalCases: true,
      totalBottles: true,
      totalWeightKg: true,
      freightCostUsd: true,
      insuranceCostUsd: true,
      originHandlingUsd: true,
      destinationHandlingUsd: true,
      customsClearanceUsd: true,
      govFeesUsd: true,
      deliveryCostUsd: true,
      otherCostsUsd: true,
      costAllocationMethod: true,
      deliveredAt: true,
    },
    orderBy: { deliveredAt: 'desc' },
  });

  // Get items for all shipments
  const shipmentIds = shipments.map((s) => s.id);
  const items =
    shipmentIds.length > 0
      ? await db.query.logisticsShipmentItems.findMany({
          where: { shipmentId: { in: shipmentIds } },
          columns: {
            id: true,
            shipmentId: true,
            productName: true,
            lwin: true,
            supplierSku: true,
            cases: true,
            bottlesPerCase: true,
            totalBottles: true,
            productCostPerBottle: true,
            declaredValueUsd: true,
            grossWeightKg: true,
            freightAllocated: true,
            handlingAllocated: true,
            govFeesAllocated: true,
            insuranceAllocated: true,
            targetSellingPrice: true,
            marginPerBottle: true,
            marginPercent: true,
          },
        })
      : [];

  /**
   * Product cost for a line, as a total rather than per bottle.
   *
   * There is no stored line total — only `product_cost_per_bottle` — so it is
   * multiplied out here. It has to be a total to sit alongside the
   * `*Allocated` columns, which are themselves line-level allocations, and to
   * be summed before dividing by the shipment's bottle count.
   */
  const lineProductCost = (item: {
    productCostPerBottle: number | null;
    totalBottles: number | null;
  }) => (item.productCostPerBottle || 0) * (item.totalBottles || 0);

  // Build shipment cost summaries
  const shipmentSummaries = shipments.map((shipment) => {
    const shipmentItems = items.filter((i) => i.shipmentId === shipment.id);

    const totalShipmentCost =
      (shipment.freightCostUsd || 0) +
      (shipment.insuranceCostUsd || 0) +
      (shipment.originHandlingUsd || 0) +
      (shipment.destinationHandlingUsd || 0) +
      (shipment.customsClearanceUsd || 0) +
      (shipment.govFeesUsd || 0) +
      (shipment.deliveryCostUsd || 0) +
      (shipment.otherCostsUsd || 0);

    const totalProductCost = shipmentItems.reduce(
      (sum, item) => sum + lineProductCost(item),
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
      shipmentType: shipment.type,
      transportMode: shipment.transportMode,
      route: `${shipment.originCity || shipment.originCountry || 'Unknown'} → ${shipment.destinationCity || shipment.destinationCountry || 'Unknown'}`,
      partner: shipment.partner?.businessName || 'N/A',
      deliveredAt: shipment.deliveredAt,
      cases: shipment.totalCases || 0,
      bottles: shipment.totalBottles || 0,
      weight: shipment.totalWeightKg || 0,
      costs: {
        product: totalProductCost,
        freight: shipment.freightCostUsd || 0,
        insurance: shipment.insuranceCostUsd || 0,
        handling: (shipment.originHandlingUsd || 0) + (shipment.destinationHandlingUsd || 0),
        customs: shipment.customsClearanceUsd || 0,
        governmentFees: shipment.govFeesUsd || 0,
        delivery: shipment.deliveryCostUsd || 0,
        other: shipment.otherCostsUsd || 0,
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
    const key = item.lwin || item.supplierSku || item.productName;
    if (!productCosts[key]) {
      productCosts[key] = {
        productName: item.productName,
        productSku: item.lwin || item.supplierSku,
        totalBottles: 0,
        totalCost: 0,
        avgCostPerBottle: 0,
        shipmentCount: 0,
        avgMarginPercentage: 0,
      };
    }

    const itemTotalCost =
      lineProductCost(item) +
      (item.freightAllocated || 0) +
      (item.handlingAllocated || 0) +
      (item.govFeesAllocated || 0) +
      (item.insuranceAllocated || 0);

    const entry = productCosts[key];
    if (!entry) continue;

    entry.totalBottles += item.totalBottles || 0;
    entry.totalCost += itemTotalCost;
    entry.shipmentCount += 1;
    if (item.marginPercent) {
      // running mean, so a product spanning several shipments is not skewed
      entry.avgMarginPercentage =
        (entry.avgMarginPercentage * (entry.shipmentCount - 1) + item.marginPercent) /
        entry.shipmentCount;
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
    const modeEntry = transportModeAnalysis[mode];
    if (!modeEntry) continue;

    modeEntry.shipmentCount += 1;
    modeEntry.totalCost += shipment.costs.totalLanded;
    modeEntry.totalBottles += shipment.bottles;
  }

  // Calculate averages for transport modes
  for (const mode of Object.keys(transportModeAnalysis)) {
    const data = transportModeAnalysis[mode];
    if (!data) continue;

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
};

export default getLandedCostReport;
