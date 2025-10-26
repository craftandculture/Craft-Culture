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

      // Distributor margin should be 15% of 5000 = 750
      expect(result.distributorMargin).toBe(750);
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

      // Total = 5000 + 1000 + 750 + 200 = 6950
      expect(result.customerQuotePrice).toBe(6950);
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
      expect(result.distributorMargin).toBe(0);
      expect(result.customerQuotePrice).toBe(200); // Only transfer cost
    });

    it('should handle zero import tax percentage', () => {
      const result = calculateB2BQuote({
        inBondPriceUsd: 5000,
        transferCostUsd: 200,
        importTaxPercent: 0,
        distributorMargin: { type: 'percentage', value: 15 },
      });

      expect(result.importTax).toBe(0);
      expect(result.customerQuotePrice).toBe(5950); // 5000 + 0 + 750 + 200
    });

    it('should handle zero distributor margin percentage', () => {
      const result = calculateB2BQuote({
        inBondPriceUsd: 5000,
        transferCostUsd: 200,
        importTaxPercent: 20,
        distributorMargin: { type: 'percentage', value: 0 },
      });

      expect(result.distributorMargin).toBe(0);
      expect(result.customerQuotePrice).toBe(6200); // 5000 + 1000 + 0 + 200
    });

    it('should handle zero fixed distributor margin', () => {
      const result = calculateB2BQuote({
        inBondPriceUsd: 5000,
        transferCostUsd: 200,
        importTaxPercent: 20,
        distributorMargin: { type: 'fixed', value: 0 },
      });

      expect(result.distributorMargin).toBe(0);
      expect(result.customerQuotePrice).toBe(6200); // 5000 + 1000 + 0 + 200
    });

    it('should handle zero transfer cost', () => {
      const result = calculateB2BQuote({
        inBondPriceUsd: 5000,
        transferCostUsd: 0,
        importTaxPercent: 20,
        distributorMargin: { type: 'percentage', value: 15 },
      });

      expect(result.transferCost).toBe(0);
      expect(result.customerQuotePrice).toBe(6750); // 5000 + 1000 + 750 + 0
    });

    it('should handle very large values', () => {
      const result = calculateB2BQuote({
        inBondPriceUsd: 1000000,
        transferCostUsd: 500,
        importTaxPercent: 20,
        distributorMargin: { type: 'percentage', value: 15 },
      });

      expect(result.importTax).toBe(200000);
      expect(result.distributorMargin).toBe(150000);
      expect(result.customerQuotePrice).toBe(1350500);
    });

    it('should handle decimal values correctly', () => {
      const result = calculateB2BQuote({
        inBondPriceUsd: 1234.56,
        transferCostUsd: 199.99,
        importTaxPercent: 20,
        distributorMargin: { type: 'percentage', value: 15 },
      });

      expect(result.importTax).toBeCloseTo(246.912, 2);
      expect(result.distributorMargin).toBeCloseTo(185.184, 2);
      expect(result.customerQuotePrice).toBeCloseTo(1866.646, 2);
    });

    it('should handle fractional percentages', () => {
      const result = calculateB2BQuote({
        inBondPriceUsd: 10000,
        transferCostUsd: 200,
        importTaxPercent: 17.5,
        distributorMargin: { type: 'percentage', value: 12.5 },
      });

      expect(result.importTax).toBe(1750);
      expect(result.distributorMargin).toBe(1250);
      expect(result.customerQuotePrice).toBe(13200);
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

      expect(result.distributorMargin).toBe(500);
      expect(result.customerQuotePrice).toBe(1800);
    });

    it('should handle large fixed margins', () => {
      const result = calculateB2BQuote({
        inBondPriceUsd: 1000,
        transferCostUsd: 100,
        importTaxPercent: 20,
        distributorMargin: { type: 'fixed', value: 5000 },
      });

      expect(result.distributorMargin).toBe(5000);
      expect(result.customerQuotePrice).toBe(6300);
    });

    it('should handle small fixed margins', () => {
      const result = calculateB2BQuote({
        inBondPriceUsd: 10000,
        transferCostUsd: 200,
        importTaxPercent: 20,
        distributorMargin: { type: 'fixed', value: 50 },
      });

      expect(result.distributorMargin).toBe(50);
      expect(result.customerQuotePrice).toBe(12250);
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
      expect(result.distributorMargin).toBe(750);
      expect(result.transferCost).toBe(200);
      expect(result.customerQuotePrice).toBe(6950);
    });

    it('should calculate correctly with custom transfer cost', () => {
      const result = calculateB2BQuote({
        inBondPriceUsd: 8000,
        transferCostUsd: 350,
        importTaxPercent: 20,
        distributorMargin: { type: 'percentage', value: 15 },
      });

      expect(result.importTax).toBe(1600);
      expect(result.distributorMargin).toBe(1200);
      expect(result.customerQuotePrice).toBe(11150);
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
      expect(result.customerQuotePrice).toBe(63200);
    });
  });
});
