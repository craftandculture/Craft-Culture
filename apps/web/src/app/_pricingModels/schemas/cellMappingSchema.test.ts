import { describe, expect, it } from 'vitest';

import cellMappingSchema from './cellMappingSchema';

describe('cellMappingSchema', () => {
  describe('valid schemas', () => {
    it('should accept minimal valid schema with required fields', () => {
      const validSchema = {
        priceUsd: 'A1:A10',
        finalPriceUsd: 'B1',
      };

      const result = cellMappingSchema.safeParse(validSchema);
      expect(result.success).toBe(true);
    });

    it('should accept schema with all optional column ranges', () => {
      const validSchema = {
        name: 'A1:A10',
        lwin18: 'B1:B10',
        region: 'C1:C10',
        producer: 'D1:D10',
        vintage: 'E1:E10',
        quantity: 'F1:F10',
        unitCount: 'G1:G10',
        unitSize: 'H1:H10',
        source: 'I1:I10',
        price: 'J1:J10',
        currency: 'K1:K10',
        exchangeRateUsd: 'L1:L10',
        basePriceUsd: 'M1:M10',
        priceUsd: 'N1:N10',
        finalPriceUsd: 'O1',
      };

      const result = cellMappingSchema.safeParse(validSchema);
      expect(result.success).toBe(true);
    });

    it('should accept schema with sheet name references', () => {
      const validSchema = {
        priceUsd: "'Sheet1'!A1:A10",
        finalPriceUsd: "'Sheet1'!B1",
      };

      const result = cellMappingSchema.safeParse(validSchema);
      expect(result.success).toBe(true);
    });

    it('should accept single cell references for optional single cell fields', () => {
      const validSchema = {
        priceUsd: 'A1:A10',
        finalPriceUsd: 'B1',
        customerName: 'C1',
        customerEmail: 'D1',
        customerType: 'E1',
      };

      const result = cellMappingSchema.safeParse(validSchema);
      expect(result.success).toBe(true);
    });

    it('should accept ranges with exactly 10 rows', () => {
      const validSchema = {
        priceUsd: 'A1:A10',
        finalPriceUsd: 'B1',
      };

      const result = cellMappingSchema.safeParse(validSchema);
      expect(result.success).toBe(true);
    });

    it('should accept ranges with less than 10 rows', () => {
      const validSchema = {
        priceUsd: 'A1:A5',
        finalPriceUsd: 'B1',
      };

      const result = cellMappingSchema.safeParse(validSchema);
      expect(result.success).toBe(true);
    });

    it('should accept single row range', () => {
      const validSchema = {
        priceUsd: 'A1:A1',
        finalPriceUsd: 'B1',
      };

      const result = cellMappingSchema.safeParse(validSchema);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid schemas - missing required fields', () => {
    it('should reject schema without priceUsd', () => {
      const invalidSchema = {
        finalPriceUsd: 'B1',
      };

      const result = cellMappingSchema.safeParse(invalidSchema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('expected string, received undefined');
      }
    });

    it('should reject schema without finalPriceUsd', () => {
      const invalidSchema = {
        priceUsd: 'A1:A10',
      };

      const result = cellMappingSchema.safeParse(invalidSchema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('expected string, received undefined');
      }
    });

    it('should reject empty schema', () => {
      const invalidSchema = {};

      const result = cellMappingSchema.safeParse(invalidSchema);
      expect(result.success).toBe(false);
    });
  });

  describe('invalid cell references', () => {
    it('should reject invalid single cell format (lowercase)', () => {
      const invalidSchema = {
        priceUsd: 'A1:A10',
        finalPriceUsd: 'b1',
      };

      const result = cellMappingSchema.safeParse(invalidSchema);
      expect(result.success).toBe(false);
    });

    it('should reject invalid single cell format (no row number)', () => {
      const invalidSchema = {
        priceUsd: 'A1:A10',
        finalPriceUsd: 'B',
      };

      const result = cellMappingSchema.safeParse(invalidSchema);
      expect(result.success).toBe(false);
    });

    it('should reject invalid column range format (no colon)', () => {
      const invalidSchema = {
        priceUsd: 'A1A10',
        finalPriceUsd: 'B1',
      };

      const result = cellMappingSchema.safeParse(invalidSchema);
      expect(result.success).toBe(false);
    });

    it('should reject range with different columns', () => {
      const invalidSchema = {
        priceUsd: 'A1:B10',
        finalPriceUsd: 'C1',
      };

      const result = cellMappingSchema.safeParse(invalidSchema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('same column');
      }
    });

    it('should reject range with more than 10 rows', () => {
      const invalidSchema = {
        priceUsd: 'A1:A11',
        finalPriceUsd: 'B1',
      };

      const result = cellMappingSchema.safeParse(invalidSchema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('max 10 rows');
      }
    });

    it('should reject range starting at row 5 and exceeding 10 rows', () => {
      const invalidSchema = {
        priceUsd: 'A5:A15',
        finalPriceUsd: 'B1',
      };

      const result = cellMappingSchema.safeParse(invalidSchema);
      expect(result.success).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle multi-letter column references', () => {
      const validSchema = {
        priceUsd: 'AA1:AA10',
        finalPriceUsd: 'AB1',
      };

      const result = cellMappingSchema.safeParse(validSchema);
      expect(result.success).toBe(true);
    });

    it('should handle large row numbers within 10 row limit', () => {
      const validSchema = {
        priceUsd: 'A100:A109',
        finalPriceUsd: 'B100',
      };

      const result = cellMappingSchema.safeParse(validSchema);
      expect(result.success).toBe(true);
    });

    it('should handle sheet names with spaces', () => {
      const validSchema = {
        priceUsd: "'My Sheet'!A1:A10",
        finalPriceUsd: "'My Sheet'!B1",
      };

      const result = cellMappingSchema.safeParse(validSchema);
      expect(result.success).toBe(true);
    });

    it('should reject malformed sheet name reference (missing closing quote)', () => {
      const invalidSchema = {
        priceUsd: "'Sheet1!A1:A10",
        finalPriceUsd: 'B1',
      };

      const result = cellMappingSchema.safeParse(invalidSchema);
      expect(result.success).toBe(false);
    });
  });
});
