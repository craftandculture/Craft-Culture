interface ProfitItem {
  sellPricePerCaseUsd: number | null;
  buyPricePerCaseUsd: number | null;
  quantityCases: number | null;
}

interface ItemProfitResult {
  profitUsd: number | null;
  profitMarginPercent: number | null;
  isLosingItem: boolean;
  lineTotalSellUsd: number | null;
  lineTotalBuyUsd: number | null;
  lineProfitUsd: number | null;
}

/**
 * Calculate profit analysis for a single line item
 *
 * @example
 *   calculateItemProfit({
 *     sellPricePerCaseUsd: 100,
 *     buyPricePerCaseUsd: 70,
 *     quantityCases: 2,
 *   });
 *   // returns {
 *   //   profitUsd: 30,
 *   //   profitMarginPercent: 30,
 *   //   isLosingItem: false,
 *   //   lineTotalSellUsd: 200,
 *   //   lineTotalBuyUsd: 140,
 *   //   lineProfitUsd: 60,
 *   // }
 */
export const calculateItemProfit = (item: ProfitItem): ItemProfitResult => {
  const { sellPricePerCaseUsd, buyPricePerCaseUsd, quantityCases } = item;

  // Cannot calculate without both prices
  if (sellPricePerCaseUsd === null || buyPricePerCaseUsd === null) {
    return {
      profitUsd: null,
      profitMarginPercent: null,
      isLosingItem: false,
      lineTotalSellUsd:
        sellPricePerCaseUsd !== null && quantityCases !== null
          ? sellPricePerCaseUsd * quantityCases
          : null,
      lineTotalBuyUsd:
        buyPricePerCaseUsd !== null && quantityCases !== null
          ? buyPricePerCaseUsd * quantityCases
          : null,
      lineProfitUsd: null,
    };
  }

  const qty = quantityCases ?? 1;
  const profitUsd = sellPricePerCaseUsd - buyPricePerCaseUsd;
  const profitMarginPercent =
    sellPricePerCaseUsd > 0 ? (profitUsd / sellPricePerCaseUsd) * 100 : 0;
  const isLosingItem = buyPricePerCaseUsd > sellPricePerCaseUsd;
  const lineTotalSellUsd = sellPricePerCaseUsd * qty;
  const lineTotalBuyUsd = buyPricePerCaseUsd * qty;
  const lineProfitUsd = profitUsd * qty;

  return {
    profitUsd: Math.round(profitUsd * 100) / 100,
    profitMarginPercent: Math.round(profitMarginPercent * 100) / 100,
    isLosingItem,
    lineTotalSellUsd: Math.round(lineTotalSellUsd * 100) / 100,
    lineTotalBuyUsd: Math.round(lineTotalBuyUsd * 100) / 100,
    lineProfitUsd: Math.round(lineProfitUsd * 100) / 100,
  };
};

interface ProfitSummary {
  totalSellPriceUsd: number;
  totalBuyPriceUsd: number;
  totalProfitUsd: number;
  profitMarginPercent: number;
  itemCount: number;
  losingItemCount: number;
}

/**
 * Calculate profit summary for a collection of items
 *
 * @example
 *   calculateProfitSummary([
 *     { sellPricePerCaseUsd: 100, buyPricePerCaseUsd: 70, quantityCases: 2 },
 *     { sellPricePerCaseUsd: 50, buyPricePerCaseUsd: 60, quantityCases: 1 },
 *   ]);
 *   // returns {
 *   //   totalSellPriceUsd: 250,
 *   //   totalBuyPriceUsd: 200,
 *   //   totalProfitUsd: 50,
 *   //   profitMarginPercent: 20,
 *   //   itemCount: 2,
 *   //   losingItemCount: 1,
 *   // }
 */
export const calculateProfitSummary = (items: ProfitItem[]): ProfitSummary => {
  let totalSellPriceUsd = 0;
  let totalBuyPriceUsd = 0;
  let itemCount = 0;
  let losingItemCount = 0;

  items.forEach((item) => {
    const result = calculateItemProfit(item);

    if (result.lineTotalSellUsd !== null) {
      totalSellPriceUsd += result.lineTotalSellUsd;
    }
    if (result.lineTotalBuyUsd !== null) {
      totalBuyPriceUsd += result.lineTotalBuyUsd;
    }
    if (result.isLosingItem) {
      losingItemCount++;
    }
    itemCount++;
  });

  const totalProfitUsd = totalSellPriceUsd - totalBuyPriceUsd;
  const profitMarginPercent =
    totalSellPriceUsd > 0 ? (totalProfitUsd / totalSellPriceUsd) * 100 : 0;

  return {
    totalSellPriceUsd: Math.round(totalSellPriceUsd * 100) / 100,
    totalBuyPriceUsd: Math.round(totalBuyPriceUsd * 100) / 100,
    totalProfitUsd: Math.round(totalProfitUsd * 100) / 100,
    profitMarginPercent: Math.round(profitMarginPercent * 100) / 100,
    itemCount,
    losingItemCount,
  };
};

/**
 * Calculate profit analysis for an entire customer PO
 * Main export - combines item-level and summary calculations
 *
 * @example
 *   calculateProfitAnalysis(items);
 */
const calculateProfitAnalysis = (items: ProfitItem[]) => {
  const itemResults = items.map((item) => ({
    ...item,
    ...calculateItemProfit(item),
  }));

  const summary = calculateProfitSummary(items);

  return {
    items: itemResults,
    summary,
  };
};

export default calculateProfitAnalysis;
