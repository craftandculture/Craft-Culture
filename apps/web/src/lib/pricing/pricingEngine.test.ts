import { describe, expect, it } from 'vitest';

import { DEFAULT_EXCHANGE_RATES, DEFAULT_PCO_VARIABLES } from './defaults';
import {
  applyMargin,
  calculateB2BAdmin,
  calculatePCOAdmin,
  calculatePCOPartner,
  calculatePocketCellarAdmin,
  calculatePocketCellarPartner,
  getLogisticsInfo,
  round2,
} from './pricingEngine';

describe('pricingEngine', () => {
  // ==========================================================================
  // Utility Functions
  // ==========================================================================

  describe('round2', () => {
    it('should round to 2 decimal places', () => {
      expect(round2(1.234)).toBe(1.23);
      expect(round2(1.235)).toBe(1.24);
      expect(round2(1.999)).toBe(2);
      expect(round2(100)).toBe(100);
    });

    it('should handle negative numbers', () => {
      expect(round2(-1.234)).toBe(-1.23);
      expect(round2(-1.235)).toBe(-1.24);
    });

    it('should handle very small numbers', () => {
      expect(round2(0.001)).toBe(0);
      expect(round2(0.005)).toBe(0.01);
    });
  });

  describe('applyMargin', () => {
    it('should apply percentage margin using division formula', () => {
      // 2.5% margin = Price ÷ 0.975
      expect(applyMargin(100, 2.5)).toBeCloseTo(102.56, 2);

      // 5% margin = Price ÷ 0.95
      expect(applyMargin(100, 5)).toBeCloseTo(105.26, 2);

      // 7.5% margin = Price ÷ 0.925
      expect(applyMargin(100, 7.5)).toBeCloseTo(108.11, 2);
    });

    it('should handle zero margin', () => {
      expect(applyMargin(100, 0)).toBe(100);
    });

    it('should handle large margins', () => {
      // 50% margin = Price ÷ 0.5
      expect(applyMargin(100, 50)).toBe(200);
    });
  });

  describe('getLogisticsInfo', () => {
    const variables = {
      ccMarginPercent: 5,
      importDutyPercent: 20,
      transferCostPercent: 0.75,
      logisticsAirPerBottle: 20,
      logisticsOceanPerBottle: 5,
      distributorMarginPercent: 7.5,
      salesCommissionPercent: 2,
      vatPercent: 5,
    };

    it('should return air logistics for CultX products', () => {
      const result = getLogisticsInfo('cultx', variables);
      expect(result.type).toBe('air');
      expect(result.perBottle).toBe(20);
    });

    it('should return no logistics for local inventory', () => {
      const result = getLogisticsInfo('local_inventory', variables);
      expect(result.type).toBe('none');
      expect(result.perBottle).toBe(0);
    });
  });

  // ==========================================================================
  // PCO Module Calculations
  // ==========================================================================

  describe('calculatePCOAdmin', () => {
    it('should calculate PCO pricing with default variables', () => {
      const result = calculatePCOAdmin(1000);

      // Step 1: C&C Margin 2.5% -> 1000 / 0.975 = 1025.64
      expect(result.landedDutyFree).toBeCloseTo(1025.64, 2);
      expect(result.ccMarginAmount).toBeCloseTo(25.64, 2);

      // Step 2: Import Duty 20% of LDF -> 1025.64 * 0.20 = 205.13
      expect(result.importDutyAmount).toBeCloseTo(205.13, 2);

      // Step 3: Transfer Cost 0.75% of LDF -> 1025.64 * 0.0075 = 7.69
      expect(result.transferCostAmount).toBeCloseTo(7.69, 2);

      // Step 4: Duty Paid Landed -> 1025.64 + 205.13 + 7.69 = 1238.46
      expect(result.dutyPaidLanded).toBeCloseTo(1238.46, 2);

      // Step 5: Distributor Margin 7.5% -> 1238.46 / 0.925 = 1338.88
      expect(result.afterDistributor).toBeCloseTo(1338.88, 2);
      expect(result.distributorMarginAmount).toBeCloseTo(100.42, 2);

      // Step 6: VAT 5% -> 1338.88 * 0.05 = 66.94
      expect(result.vatAmount).toBeCloseTo(66.94, 2);

      // Final: 1338.88 + 66.94 = 1405.82
      expect(result.finalPriceUsd).toBeCloseTo(1405.82, 2);
      expect(result.finalPriceAed).toBeCloseTo(5159.36, 2); // 1405.82 * 3.67
    });

    it('should use custom variables when provided', () => {
      const customVariables = {
        ccMarginPercent: 3,
        importDutyPercent: 15,
        transferCostPercent: 1,
        distributorMarginPercent: 10,
        vatPercent: 5,
      };

      const result = calculatePCOAdmin(1000, customVariables);

      // Step 1: C&C Margin 3% -> 1000 / 0.97 = 1030.93
      expect(result.landedDutyFree).toBeCloseTo(1030.93, 2);

      // Step 2: Import Duty 15% of LDF -> 1030.93 * 0.15 = 154.64
      expect(result.importDutyAmount).toBeCloseTo(154.64, 2);

      // Step 3: Transfer Cost 1% of LDF -> 1030.93 * 0.01 = 10.31
      expect(result.transferCostAmount).toBeCloseTo(10.31, 2);
    });

    it('should use custom exchange rates', () => {
      const customRates = { gbpToUsd: 1.27, eurToUsd: 1.08, usdToAed: 4.0 };
      const result = calculatePCOAdmin(1000, DEFAULT_PCO_VARIABLES, customRates);

      expect(result.usdToAedRate).toBe(4.0);
      expect(result.finalPriceAed).toBeCloseTo(result.finalPriceUsd * 4.0, 2);
    });

    it('should mark bespoke pricing correctly', () => {
      const result = calculatePCOAdmin(1000, DEFAULT_PCO_VARIABLES, DEFAULT_EXCHANGE_RATES, true);
      expect(result.isBespoke).toBe(true);

      const defaultResult = calculatePCOAdmin(1000);
      expect(defaultResult.isBespoke).toBe(false);
    });

    it('should handle zero supplier price', () => {
      const result = calculatePCOAdmin(0);
      expect(result.supplierPriceUsd).toBe(0);
      expect(result.landedDutyFree).toBe(0);
      expect(result.finalPriceUsd).toBe(0);
    });

    it('should handle very large supplier price', () => {
      const result = calculatePCOAdmin(1000000);

      // Verify proportions are maintained
      expect(result.landedDutyFree).toBeCloseTo(1025641.03, 2);
      expect(result.importDutyAmount).toBeCloseTo(205128.21, 2);
    });
  });

  describe('calculatePCOPartner', () => {
    it('should return consolidated partner view', () => {
      const result = calculatePCOPartner(1000);

      // Subtotal = Landed Duty Free (hides C&C margin)
      expect(result.subtotalUsd).toBeCloseTo(1025.64, 2);

      // Duty = Import Duty Amount
      expect(result.dutyUsd).toBeCloseTo(205.13, 2);

      // Logistics = Transfer Cost
      expect(result.logisticsUsd).toBeCloseTo(7.69, 2);

      // VAT
      expect(result.vatUsd).toBeCloseTo(66.94, 2);

      // Total
      expect(result.totalUsd).toBeCloseTo(1405.82, 2);
      expect(result.totalAed).toBeCloseTo(5159.36, 2);
    });

    it('should match admin calculation totals', () => {
      const adminResult = calculatePCOAdmin(5000);
      const partnerResult = calculatePCOPartner(5000);

      expect(partnerResult.totalUsd).toBe(adminResult.finalPriceUsd);
      expect(partnerResult.totalAed).toBe(adminResult.finalPriceAed);
    });
  });

  // ==========================================================================
  // B2B Module Calculations
  // ==========================================================================

  describe('calculateB2BAdmin', () => {
    it('should calculate B2B pricing with default 5% margin', () => {
      const result = calculateB2BAdmin(1000);

      // 5% margin = 1000 / 0.95 = 1052.63
      expect(result.finalPriceUsd).toBeCloseTo(1052.63, 2);
      expect(result.ccMarginAmount).toBeCloseTo(52.63, 2);
      expect(result.ccMarginPercent).toBe(5);
    });

    it('should convert to AED correctly', () => {
      const result = calculateB2BAdmin(1000);

      expect(result.finalPriceAed).toBeCloseTo(3863.16, 2); // 1052.63 * 3.67
      expect(result.usdToAedRate).toBe(3.67);
    });

    it('should use custom margin', () => {
      const customVariables = { ccMarginPercent: 10 };
      const result = calculateB2BAdmin(1000, customVariables);

      // 10% margin = 1000 / 0.90 = 1111.11
      expect(result.finalPriceUsd).toBeCloseTo(1111.11, 2);
      expect(result.ccMarginAmount).toBeCloseTo(111.11, 2);
    });

    it('should use custom exchange rate', () => {
      const customRates = { gbpToUsd: 1.27, eurToUsd: 1.08, usdToAed: 4.0 };
      const result = calculateB2BAdmin(1000, { ccMarginPercent: 5 }, customRates);

      expect(result.finalPriceAed).toBeCloseTo(4210.53, 2); // 1052.63 * 4.0
    });

    it('should handle zero price', () => {
      const result = calculateB2BAdmin(0);
      expect(result.supplierPriceUsd).toBe(0);
      expect(result.finalPriceUsd).toBe(0);
      expect(result.ccMarginAmount).toBe(0);
    });

    it('should handle decimal prices', () => {
      const result = calculateB2BAdmin(1234.56);
      expect(result.supplierPriceUsd).toBe(1234.56);
      expect(result.finalPriceUsd).toBeCloseTo(1299.54, 2);
    });
  });

  // ==========================================================================
  // Pocket Cellar Module Calculations
  // ==========================================================================

  describe('calculatePocketCellarAdmin', () => {
    describe('CultX products (international)', () => {
      it('should include air logistics for CultX products', () => {
        // 6 bottles
        const result = calculatePocketCellarAdmin(100, 'cultx', 6);

        // Step 1: C&C Margin 5% -> 100 / 0.95 = 105.26
        expect(result.afterCcMargin).toBeCloseTo(105.26, 2);

        // Step 2: Logistics $20/bottle × 6 = $120
        expect(result.logisticsType).toBe('air');
        expect(result.logisticsPerBottle).toBe(20);
        expect(result.logisticsAmount).toBe(120);

        // Landed Duty Free = 105.26 + 120 = 225.26
        expect(result.landedDutyFree).toBeCloseTo(225.26, 2);
      });

      it('should calculate full pricing chain for CultX', () => {
        const result = calculatePocketCellarAdmin(100, 'cultx', 6);

        // LDF = 225.26
        // Import Duty 20% = ~45.05
        expect(result.importDutyAmount).toBeCloseTo(45.05, 1);

        // Transfer Cost 0.75% = ~1.69
        expect(result.transferCostAmount).toBeCloseTo(1.69, 1);

        // Duty Paid Landed = ~272
        expect(result.dutyPaidLanded).toBeCloseTo(272, 0);

        // Distributor Margin 7.5% -> ~294
        expect(result.afterDistributor).toBeCloseTo(294, 0);

        // Sales Commission 2% = ~5.88
        expect(result.salesCommissionAmount).toBeCloseTo(5.88, 1);

        // Pre-VAT = ~300
        expect(result.preVat).toBeCloseTo(300, 0);

        // VAT 5% = ~15
        expect(result.vatAmount).toBeCloseTo(15.0, 0);

        // Final = ~315
        expect(result.finalPriceUsd).toBeCloseTo(315, 0);
      });
    });

    describe('Local inventory products', () => {
      it('should have no logistics for local inventory', () => {
        const result = calculatePocketCellarAdmin(100, 'local_inventory', 6);

        expect(result.logisticsType).toBe('none');
        expect(result.logisticsPerBottle).toBe(0);
        expect(result.logisticsAmount).toBe(0);

        // Landed Duty Free = just afterCcMargin
        expect(result.landedDutyFree).toBeCloseTo(105.26, 2);
      });

      it('should be cheaper than CultX due to no logistics', () => {
        const cultxResult = calculatePocketCellarAdmin(100, 'cultx', 6);
        const localResult = calculatePocketCellarAdmin(100, 'local_inventory', 6);

        expect(localResult.finalPriceUsd).toBeLessThan(cultxResult.finalPriceUsd);
      });
    });

    it('should handle single bottle', () => {
      const result = calculatePocketCellarAdmin(50, 'cultx', 1);

      expect(result.logisticsAmount).toBe(20); // $20 for 1 bottle
    });

    it('should handle custom variables', () => {
      const customVariables = {
        ccMarginPercent: 3,
        importDutyPercent: 15,
        transferCostPercent: 0.5,
        logisticsAirPerBottle: 15,
        logisticsOceanPerBottle: 3,
        distributorMarginPercent: 5,
        salesCommissionPercent: 1,
        vatPercent: 5,
      };

      const result = calculatePocketCellarAdmin(100, 'cultx', 6, customVariables);

      expect(result.ccMarginPercent).toBe(3);
      expect(result.logisticsPerBottle).toBe(15);
      expect(result.importDutyPercent).toBe(15);
    });
  });

  describe('calculatePocketCellarPartner', () => {
    it('should return consolidated partner view', () => {
      const result = calculatePocketCellarPartner(100, 'cultx', 6);

      // Subtotal = Landed Duty Free
      expect(result.subtotalUsd).toBeCloseTo(225.26, 2);

      // Duty = Import Duty Amount
      expect(result.dutyUsd).toBeCloseTo(45.05, 2);

      // Logistics = Transfer Cost + Logistics Amount
      expect(result.logisticsUsd).toBeCloseTo(121.69, 2); // 1.69 + 120

      // VAT
      expect(result.vatUsd).toBeCloseTo(15.0, 2);

      // Total
      expect(result.totalUsd).toBeCloseTo(314.94, 2);
    });

    it('should match admin calculation totals', () => {
      const adminResult = calculatePocketCellarAdmin(500, 'cultx', 12);
      const partnerResult = calculatePocketCellarPartner(500, 'cultx', 12);

      expect(partnerResult.totalUsd).toBe(adminResult.finalPriceUsd);
      expect(partnerResult.totalAed).toBe(adminResult.finalPriceAed);
    });
  });

  // ==========================================================================
  // Realistic Business Scenarios
  // ==========================================================================

  describe('realistic scenarios', () => {
    describe('PCO wine order', () => {
      it('should calculate correctly for typical PCO case', () => {
        // Partner invoice price per case: $150
        const result = calculatePCOAdmin(150);

        // Verify margins are reasonable
        expect(result.ccMarginAmount).toBeLessThan(result.supplierPriceUsd * 0.05);
        expect(result.finalPriceUsd).toBeGreaterThan(result.supplierPriceUsd * 1.3);
        expect(result.finalPriceUsd).toBeLessThan(result.supplierPriceUsd * 1.6);
      });

      it('should calculate multi-case order', () => {
        // 10 cases at $120 each = $1200 total
        const result = calculatePCOAdmin(1200);

        expect(result.finalPriceUsd).toBeGreaterThan(1500);
        expect(result.finalPriceUsd).toBeLessThan(2000);
      });
    });

    describe('B2B quote', () => {
      it('should calculate correctly for typical B2B order', () => {
        // $5000 supplier price
        const result = calculateB2BAdmin(5000);

        expect(result.finalPriceUsd).toBeCloseTo(5263.16, 2);
        expect(result.ccMarginAmount).toBeCloseTo(263.16, 2);
      });
    });

    describe('Pocket Cellar consumer pricing', () => {
      it('should calculate per-bottle consumer price from CultX', () => {
        // Case of 6 bottles at $80 wholesale
        const result = calculatePocketCellarAdmin(80, 'cultx', 6);

        // Per bottle = finalPriceUsd / 6
        const perBottle = result.finalPriceUsd / 6;
        expect(perBottle).toBeGreaterThan(40);
        expect(perBottle).toBeLessThan(60);
      });

      it('should calculate per-bottle consumer price from local inventory', () => {
        // Case of 12 bottles at $100 wholesale
        const result = calculatePocketCellarAdmin(100, 'local_inventory', 12);

        // Per bottle = finalPriceUsd / 12
        const perBottle = result.finalPriceUsd / 12;
        expect(perBottle).toBeGreaterThan(10);
        expect(perBottle).toBeLessThan(20);
      });
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle very small prices', () => {
      const pcoResult = calculatePCOAdmin(0.01);
      expect(pcoResult.finalPriceUsd).toBeGreaterThan(0);

      const b2bResult = calculateB2BAdmin(0.01);
      expect(b2bResult.finalPriceUsd).toBeGreaterThan(0);
    });

    it('should handle very large prices', () => {
      const pcoResult = calculatePCOAdmin(1000000);
      expect(pcoResult.finalPriceUsd).toBeGreaterThan(1000000);

      const b2bResult = calculateB2BAdmin(1000000);
      expect(b2bResult.finalPriceUsd).toBeGreaterThan(1000000);
    });

    it('should maintain mathematical consistency', () => {
      const result = calculatePCOAdmin(1000);

      // Verify the formula chain
      const expectedDPL =
        result.landedDutyFree + result.importDutyAmount + result.transferCostAmount;
      expect(result.dutyPaidLanded).toBeCloseTo(expectedDPL, 2);

      const expectedAfterDist = result.dutyPaidLanded + result.distributorMarginAmount;
      expect(result.afterDistributor).toBeCloseTo(expectedAfterDist, 2);

      const expectedFinal = result.afterDistributor + result.vatAmount;
      expect(result.finalPriceUsd).toBeCloseTo(expectedFinal, 2);
    });

    it('should handle zero margin percentages gracefully', () => {
      const zeroMarginVars = {
        ccMarginPercent: 0,
        importDutyPercent: 0,
        transferCostPercent: 0,
        distributorMarginPercent: 0,
        vatPercent: 0,
      };

      const result = calculatePCOAdmin(1000, zeroMarginVars);

      // With all zeros, price should remain $1000
      expect(result.finalPriceUsd).toBe(1000);
      expect(result.landedDutyFree).toBe(1000);
      expect(result.dutyPaidLanded).toBe(1000);
    });
  });
});
