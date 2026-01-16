import type { LogisticsShipment, LogisticsShipmentItem } from '@/database/schema';

interface LandedCostResult {
  totalLandedCost: number;
  landedCostPerBottle: number;
  items: Array<{
    itemId: string;
    totalBottles: number;
    allocationRatio: number;
    freightAllocated: number;
    handlingAllocated: number;
    insuranceAllocated: number;
    govFeesAllocated: number;
    landedCostTotal: number;
    landedCostPerBottle: number;
    marginPerBottle: number | null;
    marginPercent: number | null;
  }>;
}

/**
 * Calculate landed cost for a shipment and allocate to items
 *
 * LANDED COST = Product Cost + Freight + Insurance + Handling + Customs + Gov Fees + Delivery
 *
 * Allocation methods:
 * - by_bottle: Split costs by bottle count (default)
 * - by_weight: Split costs by gross weight
 * - by_value: Split costs by declared value
 *
 * @example
 *   const result = calculateLandedCost(shipment, items);
 *   console.log(result.landedCostPerBottle); // e.g., $18.88
 */
const calculateLandedCost = (
  shipment: LogisticsShipment,
  items: LogisticsShipmentItem[],
): LandedCostResult => {
  // Sum all shipment-level costs
  const freightCost = shipment.freightCostUsd ?? 0;
  const insuranceCost = shipment.insuranceCostUsd ?? 0;
  const originHandling = shipment.originHandlingUsd ?? 0;
  const destinationHandling = shipment.destinationHandlingUsd ?? 0;
  const customsClearance = shipment.customsClearanceUsd ?? 0;
  const govFees = shipment.govFeesUsd ?? 0;
  const deliveryCost = shipment.deliveryCostUsd ?? 0;
  const otherCosts = shipment.otherCostsUsd ?? 0;

  const totalHandling = originHandling + destinationHandling + customsClearance + deliveryCost + otherCosts;
  const totalShipmentCosts = freightCost + insuranceCost + totalHandling + govFees;

  // Calculate product cost from items
  const totalProductCost = items.reduce((sum, item) => {
    const bottles = item.totalBottles ?? item.cases * (item.bottlesPerCase ?? 12);
    const costPerBottle = item.productCostPerBottle ?? 0;
    return sum + bottles * costPerBottle;
  }, 0);

  const totalLandedCost = totalProductCost + totalShipmentCosts;

  // Calculate total bottles across all items
  const totalBottles = items.reduce((sum, item) => {
    return sum + (item.totalBottles ?? item.cases * (item.bottlesPerCase ?? 12));
  }, 0);

  // Calculate allocation denominator based on method
  const allocationMethod = shipment.costAllocationMethod ?? 'by_bottle';

  let allocationDenominator = 0;

  if (allocationMethod === 'by_bottle') {
    allocationDenominator = totalBottles;
  } else if (allocationMethod === 'by_weight') {
    allocationDenominator = items.reduce((sum, item) => sum + (item.grossWeightKg ?? 0), 0);
  } else if (allocationMethod === 'by_value') {
    allocationDenominator = items.reduce((sum, item) => sum + (item.declaredValueUsd ?? 0), 0);
  }

  // Avoid division by zero
  if (allocationDenominator === 0) {
    allocationDenominator = 1;
  }

  // Calculate per-item allocations
  const itemResults = items.map((item) => {
    const itemBottles = item.totalBottles ?? item.cases * (item.bottlesPerCase ?? 12);

    // Determine allocation ratio based on method
    let allocationRatio = 0;
    if (allocationMethod === 'by_bottle') {
      allocationRatio = itemBottles / allocationDenominator;
    } else if (allocationMethod === 'by_weight') {
      allocationRatio = (item.grossWeightKg ?? 0) / allocationDenominator;
    } else if (allocationMethod === 'by_value') {
      allocationRatio = (item.declaredValueUsd ?? 0) / allocationDenominator;
    }

    // Allocate shipment costs to this item
    const freightAllocated = freightCost * allocationRatio;
    const handlingAllocated = totalHandling * allocationRatio;
    const insuranceAllocated = insuranceCost * allocationRatio;
    const govFeesAllocated = govFees * allocationRatio;

    // Total landed cost for this item
    const itemProductCost = itemBottles * (item.productCostPerBottle ?? 0);
    const landedCostTotal =
      itemProductCost + freightAllocated + handlingAllocated + insuranceAllocated + govFeesAllocated;

    // Per bottle
    const landedCostPerBottle = itemBottles > 0 ? landedCostTotal / itemBottles : 0;

    // Margin calculation
    let marginPerBottle: number | null = null;
    let marginPercent: number | null = null;

    if (item.targetSellingPrice && item.targetSellingPrice > 0) {
      marginPerBottle = item.targetSellingPrice - landedCostPerBottle;
      marginPercent = (marginPerBottle / landedCostPerBottle) * 100;
    }

    return {
      itemId: item.id,
      totalBottles: itemBottles,
      allocationRatio,
      freightAllocated,
      handlingAllocated,
      insuranceAllocated,
      govFeesAllocated,
      landedCostTotal,
      landedCostPerBottle,
      marginPerBottle,
      marginPercent,
    };
  });

  const landedCostPerBottle = totalBottles > 0 ? totalLandedCost / totalBottles : 0;

  return {
    totalLandedCost,
    landedCostPerBottle,
    items: itemResults,
  };
};

export default calculateLandedCost;
