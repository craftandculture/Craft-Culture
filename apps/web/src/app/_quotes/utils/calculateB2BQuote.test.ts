import { describe, expect, it } from 'vitest';

import calculateB2BQuote from './calculateB2BQuote';

describe('calculateB2BQuote', () => {
  describe('basic calculations', () => {
    it('should calculate import tax on in bond price only', () => {
      const result = calculateB2BQuote({
        inBondPriceUsd: 5000,
        transferCostUsd: 200,
        importTaxPercent: 20,
        distributorMargin: { type: 'percentage', value: 15 },
      });

      // Import tax should be 20% of 5000 = 1000
      expect(result.importTax).toBe(1000);
    });

    it('should calculate distributor margin on in bond price only (percentage mode)', () => {
      const result = calculateB2BQuote({
        inBondPriceUsd: 5000,
        transferCostUsd: 200,
        importTaxPercent: 20,
        distributorMargin: { type: 'percentage', value: 15 },
      });

      // landedPrice = 5000 + 1000 + 200 = 6200
      // priceAfterMargin = 6200 / (1 - 0.15) = 7294.12
      // margin = 7294.12 - 6200 = 1094.12
      expect(result.distributorMargin).toBeCloseTo(1094.12, 2);
    });

    it('should use fixed cash amount for distributor margin (fixed mode)', () => {
      const result = calculateB2BQuote({
        inBondPriceUsd: 5000,
        transferCostUsd: 200,
        importTaxPercent: 20,
        distributorMargin: { type: 'fixed', value: 1500 },
      });

      // Distributor margin should be fixed value of 1500
      expect(result.distributorMargin).toBe(1500);
    });

    it('should sum all components correctly', () => {
      const result = calculateB2BQuote({
        inBondPriceUsd: 5000,
        transferCostUsd: 200,
        importTaxPercent: 20,
        distributorMargin: { type: 'percentage', value: 15 },
      });

      // landedPrice = 6200, priceAfterMargin = 7294.12
      // vat = 7294.12 * 0.05 = 364.71
      // customerQuotePrice = 7294.12 + 364.71 = 7658.82
      expect(result.customerQuotePrice).toBeCloseTo(7658.82, 2);
      expect(result.inBondPrice).toBe(5000);
      expect(result.transferCost).toBe(200);
    });
  });

  describe('edge cases', () => {
    it('should handle zero in bond price', () => {
      const result = calculateB2BQuote({
        inBondPriceUsd: 0,
        transferCostUsd: 200,
        importTaxPercent: 20,
        distributorMargin: { type: 'percentage', value: 15 },
      });

      expect(result.inBondPrice).toBe(0);
      expect(result.importTax).toBe(0);
      // landedPrice = 200, priceAfterMargin = 200 / 0.85 = 235.29
      // margin = 235.29 - 200 = 35.29
      // vat = 235.29 * 0.05 = 11.76
      // customerQuotePrice = 235.29 + 11.76 = 247.06
      expect(result.distributorMargin).toBeCloseTo(35.29, 2);
      expect(result.customerQuotePrice).toBeCloseTo(247.06, 2);
    });

    it('should handle zero import tax percentage', () => {
      const result = calculateB2BQuote({
        inBondPriceUsd: 5000,
        transferCostUsd: 200,
        importTaxPercent: 0,
        distributorMargin: { type: 'percentage', value: 15 },
      });

      expect(result.importTax).toBe(0);
      // landedPrice = 5000 + 0 + 200 = 5200
      // priceAfterMargin = 5200 / 0.85 = 6117.65
      // vat = 6117.65 * 0.05 = 305.88
      // customerQuotePrice = 6117.65 + 305.88 = 6423.53
      expect(result.customerQuotePrice).toBeCloseTo(6423.53, 2);
    });

    it('should handle zero distributor margin percentage', () => {
      const result = calculateB2BQuote({
        inBondPriceUsd: 5000,
        transferCostUsd: 200,
        importTaxPercent: 20,
        distributorMargin: { type: 'percentage', value: 0 },
      });

      expect(result.distributorMargin).toBe(0);
      // landedPrice = 6200, priceAfterMargin = 6200 / 1 = 6200
      // vat = 6200 * 0.05 = 310
      // customerQuotePrice = 6200 + 310 = 6510
      expect(result.customerQuotePrice).toBe(6510);
    });

    it('should handle zero fixed distributor margin', () => {
      const result = calculateB2BQuote({
        inBondPriceUsd: 5000,
        transferCostUsd: 200,
        importTaxPercent: 20,
        distributorMargin: { type: 'fixed', value: 0 },
      });

      expect(result.distributorMargin).toBe(0);
      // landedPrice = 6200, priceAfterMargin = 6200 + 0 = 6200
      // vat = 6200 * 0.05 = 310
      // customerQuotePrice = 6200 + 310 = 6510
      expect(result.customerQuotePrice).toBe(6510);
    });

    it('should handle zero transfer cost', () => {
      const result = calculateB2BQuote({
        inBondPriceUsd: 5000,
        transferCostUsd: 0,
        importTaxPercent: 20,
        distributorMargin: { type: 'percentage', value: 15 },
      });

      expect(result.transferCost).toBe(0);
      // landedPrice = 5000 + 1000 + 0 = 6000
      // priceAfterMargin = 6000 / 0.85 = 7058.82
      // vat = 7058.82 * 0.05 = 352.94
      // customerQuotePrice = 7058.82 + 352.94 = 7411.76
      expect(result.customerQuotePrice).toBeCloseTo(7411.76, 2);
    });

    it('should handle very large values', () => {
      const result = calculateB2BQuote({
        inBondPriceUsd: 1000000,
        transferCostUsd: 500,
        importTaxPercent: 20,
        distributorMargin: { type: 'percentage', value: 15 },
      });

      expect(result.importTax).toBe(200000);
      // landedPrice = 1000000 + 200000 + 500 = 1200500
      // priceAfterMargin = 1200500 / 0.85 = 1412352.94
      // margin = 1412352.94 - 1200500 = 211852.94
      // vat = 1412352.94 * 0.05 = 70617.65
      // customerQuotePrice = 1412352.94 + 70617.65 = 1482970.59
      expect(result.distributorMargin).toBeCloseTo(211852.94, 2);
      expect(result.customerQuotePrice).toBeCloseTo(1482970.59, 2);
    });

    it('should handle decimal values correctly', () => {
      const result = calculateB2BQuote({
        inBondPriceUsd: 1234.56,
        transferCostUsd: 199.99,
        importTaxPercent: 20,
        distributorMargin: { type: 'percentage', value: 15 },
      });

      expect(result.importTax).toBeCloseTo(246.912, 2);
      // landedPrice = 1234.56 + 246.912 + 199.99 = 1681.462
      // priceAfterMargin = 1681.462 / 0.85 = 1978.19
      // margin = 1978.19 - 1681.462 = 296.73
      // vat = 1978.19 * 0.05 = 98.91
      // customerQuotePrice = 1978.19 + 98.91 = 2077.10
      expect(result.distributorMargin).toBeCloseTo(296.73, 2);
      expect(result.customerQuotePrice).toBeCloseTo(2077.10, 2);
    });

    it('should handle fractional percentages', () => {
      const result = calculateB2BQuote({
        inBondPriceUsd: 10000,
        transferCostUsd: 200,
        importTaxPercent: 17.5,
        distributorMargin: { type: 'percentage', value: 12.5 },
      });

      expect(result.importTax).toBe(1750);
      // landedPrice = 10000 + 1750 + 200 = 11950
      // priceAfterMargin = 11950 / (1 - 0.125) = 11950 / 0.875 = 13657.14
      // margin = 13657.14 - 11950 = 1707.14
      // vat = 13657.14 * 0.05 = 682.86
      // customerQuotePrice = 13657.14 + 682.86 = 14340
      expect(result.distributorMargin).toBeCloseTo(1707.14, 2);
      expect(result.customerQuotePrice).toBeCloseTo(14340, 2);
    });
  });

  describe('different margin configurations', () => {
    it('should handle high percentage margins', () => {
      const result = calculateB2BQuote({
        inBondPriceUsd: 1000,
        transferCostUsd: 100,
        importTaxPercent: 20,
        distributorMargin: { type: 'percentage', value: 50 },
      });

      // landedPrice = 1000 + 200 + 100 = 1300
      // priceAfterMargin = 1300 / (1 - 0.50) = 1300 / 0.50 = 2600
      // margin = 2600 - 1300 = 1300
      // vat = 2600 * 0.05 = 130
      // customerQuotePrice = 2600 + 130 = 2730
      expect(result.distributorMargin).toBe(1300);
      expect(result.customerQuotePrice).toBe(2730);
    });

    it('should handle large fixed margins', () => {
      const result = calculateB2BQuote({
        inBondPriceUsd: 1000,
        transferCostUsd: 100,
        importTaxPercent: 20,
        distributorMargin: { type: 'fixed', value: 5000 },
      });

      expect(result.distributorMargin).toBe(5000);
      // landedPrice = 1000 + 200 + 100 = 1300
      // priceAfterMargin = 1300 + 5000 = 6300
      // vat = 6300 * 0.05 = 315
      // customerQuotePrice = 6300 + 315 = 6615
      expect(result.customerQuotePrice).toBe(6615);
    });

    it('should handle small fixed margins', () => {
      const result = calculateB2BQuote({
        inBondPriceUsd: 10000,
        transferCostUsd: 200,
        importTaxPercent: 20,
        distributorMargin: { type: 'fixed', value: 50 },
      });

      expect(result.distributorMargin).toBe(50);
      // landedPrice = 10000 + 2000 + 200 = 12200
      // priceAfterMargin = 12200 + 50 = 12250
      // vat = 12250 * 0.05 = 612.5
      // customerQuotePrice = 12250 + 612.5 = 12862.5
      expect(result.customerQuotePrice).toBe(12862.5);
    });
  });

  describe('realistic scenarios', () => {
    it('should calculate correctly for typical wine order', () => {
      // 5 cases at $1000 per case = $5000 in bond
      const result = calculateB2BQuote({
        inBondPriceUsd: 5000,
        transferCostUsd: 200,
        importTaxPercent: 20,
        distributorMargin: { type: 'percentage', value: 15 },
      });

      expect(result.inBondPrice).toBe(5000);
      expect(result.importTax).toBe(1000);
      // landedPrice = 6200, priceAfterMargin = 7294.12
      // margin = 1094.12, vat = 364.71, customerQuotePrice = 7658.82
      expect(result.distributorMargin).toBeCloseTo(1094.12, 2);
      expect(result.transferCost).toBe(200);
      expect(result.customerQuotePrice).toBeCloseTo(7658.82, 2);
    });

    it('should calculate correctly with custom transfer cost', () => {
      const result = calculateB2BQuote({
        inBondPriceUsd: 8000,
        transferCostUsd: 350,
        importTaxPercent: 20,
        distributorMargin: { type: 'percentage', value: 15 },
      });

      expect(result.importTax).toBe(1600);
      // landedPrice = 8000 + 1600 + 350 = 9950
      // priceAfterMargin = 9950 / 0.85 = 11705.88
      // margin = 11705.88 - 9950 = 1755.88
      // vat = 11705.88 * 0.05 = 585.29
      // customerQuotePrice = 11705.88 + 585.29 = 12291.18
      expect(result.distributorMargin).toBeCloseTo(1755.88, 2);
      expect(result.customerQuotePrice).toBeCloseTo(12291.18, 2);
    });

    it('should calculate correctly with fixed margin for high-volume order', () => {
      const result = calculateB2BQuote({
        inBondPriceUsd: 50000,
        transferCostUsd: 200,
        importTaxPercent: 20,
        distributorMargin: { type: 'fixed', value: 3000 },
      });

      expect(result.importTax).toBe(10000);
      expect(result.distributorMargin).toBe(3000);
      // landedPrice = 50000 + 10000 + 200 = 60200
      // priceAfterMargin = 60200 + 3000 = 63200
      // vat = 63200 * 0.05 = 3160
      // customerQuotePrice = 63200 + 3160 = 66360
      expect(result.customerQuotePrice).toBe(66360);
    });
  });
});
