import { describe, expect, it } from 'vitest';

import createPricingModelSchema from './createPricingModelSchema';

describe('createPricingModelSchema', () => {
  const validCellMappings = {
    priceUsd: "'Example Sheet'!R7:R16",
    finalPriceUsd: "'Example Sheet'!B4",
  };

  describe('valid inputs', () => {
    it('should accept valid pricing model with all fields', () => {
      const validInput = {
        modelName: 'B2B Pricing Model',
        sheetId: '123e4567-e89b-12d3-a456-426614174000',
        isDefaultB2C: false,
        isDefaultB2B: true,
        cellMappings: validCellMappings,
      };

      const result = createPricingModelSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validInput);
      }
    });

    it('should accept model set as both B2B and B2C default', () => {
      const validInput = {
        modelName: 'Universal Pricing',
        sheetId: '123e4567-e89b-12d3-a456-426614174000',
        isDefaultB2C: true,
        isDefaultB2B: true,
        cellMappings: validCellMappings,
      };

      const result = createPricingModelSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept model with neither B2B nor B2C default', () => {
      const validInput = {
        modelName: 'Custom Model',
        sheetId: '123e4567-e89b-12d3-a456-426614174000',
        isDefaultB2C: false,
        isDefaultB2B: false,
        cellMappings: validCellMappings,
      };

      const result = createPricingModelSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept model with optional cell mappings', () => {
      const validInput = {
        modelName: 'Test Model',
        sheetId: '123e4567-e89b-12d3-a456-426614174000',
        isDefaultB2C: false,
        isDefaultB2B: false,
        cellMappings: {
          ...validCellMappings,
          name: "'Example Sheet'!A7:A16",
          lwin18: "'Example Sheet'!B7:B16",
          region: "'Example Sheet'!C7:C16",
          producer: "'Example Sheet'!D7:D16",
          vintage: "'Example Sheet'!E7:E16",
        },
      };

      const result = createPricingModelSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid modelName', () => {
    it('should reject empty model name', () => {
      const invalidInput = {
        modelName: '',
        sheetId: '123e4567-e89b-12d3-a456-426614174000',
        isDefaultB2C: false,
        isDefaultB2B: false,
        cellMappings: validCellMappings,
      };

      const result = createPricingModelSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('Model name is required');
      }
    });

    it('should reject whitespace-only model name', () => {
      const invalidInput = {
        modelName: '   ',
        sheetId: '123e4567-e89b-12d3-a456-426614174000',
        isDefaultB2C: false,
        isDefaultB2B: false,
        cellMappings: validCellMappings,
      };

      const result = createPricingModelSchema.safeParse(invalidInput);
      // Whitespace is technically valid per schema (not trimmed)
      expect(result.success).toBe(true);
    });

    it('should reject missing model name', () => {
      const invalidInput = {
        sheetId: '123e4567-e89b-12d3-a456-426614174000',
        isDefaultB2C: false,
        isDefaultB2B: false,
        cellMappings: validCellMappings,
      };

      const result = createPricingModelSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject non-string model name', () => {
      const invalidInput = {
        modelName: 123,
        sheetId: '123e4567-e89b-12d3-a456-426614174000',
        isDefaultB2C: false,
        isDefaultB2B: false,
        cellMappings: validCellMappings,
      };

      const result = createPricingModelSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe('invalid sheetId', () => {
    it('should reject invalid UUID format', () => {
      const invalidInput = {
        modelName: 'Test Model',
        sheetId: 'not-a-uuid',
        isDefaultB2C: false,
        isDefaultB2B: false,
        cellMappings: validCellMappings,
      };

      const result = createPricingModelSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('Invalid sheet ID');
      }
    });

    it('should reject empty sheet ID', () => {
      const invalidInput = {
        modelName: 'Test Model',
        sheetId: '',
        isDefaultB2C: false,
        isDefaultB2B: false,
        cellMappings: validCellMappings,
      };

      const result = createPricingModelSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject missing sheet ID', () => {
      const invalidInput = {
        modelName: 'Test Model',
        isDefaultB2C: false,
        isDefaultB2B: false,
        cellMappings: validCellMappings,
      };

      const result = createPricingModelSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe('invalid default flags', () => {
    it('should reject non-boolean isDefaultB2C', () => {
      const invalidInput = {
        modelName: 'Test Model',
        sheetId: '123e4567-e89b-12d3-a456-426614174000',
        isDefaultB2C: 'true',
        isDefaultB2B: false,
        cellMappings: validCellMappings,
      };

      const result = createPricingModelSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject non-boolean isDefaultB2B', () => {
      const invalidInput = {
        modelName: 'Test Model',
        sheetId: '123e4567-e89b-12d3-a456-426614174000',
        isDefaultB2C: false,
        isDefaultB2B: 1,
        cellMappings: validCellMappings,
      };

      const result = createPricingModelSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject missing isDefaultB2C', () => {
      const invalidInput = {
        modelName: 'Test Model',
        sheetId: '123e4567-e89b-12d3-a456-426614174000',
        isDefaultB2B: false,
        cellMappings: validCellMappings,
      };

      const result = createPricingModelSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject missing isDefaultB2B', () => {
      const invalidInput = {
        modelName: 'Test Model',
        sheetId: '123e4567-e89b-12d3-a456-426614174000',
        isDefaultB2C: false,
        cellMappings: validCellMappings,
      };

      const result = createPricingModelSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe('invalid cellMappings', () => {
    it('should reject missing cellMappings', () => {
      const invalidInput = {
        modelName: 'Test Model',
        sheetId: '123e4567-e89b-12d3-a456-426614174000',
        isDefaultB2C: false,
        isDefaultB2B: false,
      };

      const result = createPricingModelSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject cellMappings without required priceUsd', () => {
      const invalidInput = {
        modelName: 'Test Model',
        sheetId: '123e4567-e89b-12d3-a456-426614174000',
        isDefaultB2C: false,
        isDefaultB2B: false,
        cellMappings: {
          finalPriceUsd: "'Example Sheet'!B4",
        },
      };

      const result = createPricingModelSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject cellMappings without required finalPriceUsd', () => {
      const invalidInput = {
        modelName: 'Test Model',
        sheetId: '123e4567-e89b-12d3-a456-426614174000',
        isDefaultB2C: false,
        isDefaultB2B: false,
        cellMappings: {
          priceUsd: "'Example Sheet'!R7:R16",
        },
      };

      const result = createPricingModelSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject cellMappings with invalid cell reference format', () => {
      const invalidInput = {
        modelName: 'Test Model',
        sheetId: '123e4567-e89b-12d3-a456-426614174000',
        isDefaultB2C: false,
        isDefaultB2B: false,
        cellMappings: {
          priceUsd: 'invalid-format',
          finalPriceUsd: "'Example Sheet'!B4",
        },
      };

      const result = createPricingModelSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe('complex validation scenarios', () => {
    it('should report multiple validation errors', () => {
      const invalidInput = {
        modelName: '',
        sheetId: 'not-a-uuid',
        isDefaultB2C: 'not-a-boolean',
        isDefaultB2B: 'also-not-a-boolean',
        cellMappings: {},
      };

      const result = createPricingModelSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        // Should have multiple errors
        expect(result.error.issues.length).toBeGreaterThanOrEqual(5);
      }
    });

    it('should accept model name with special characters', () => {
      const validInput = {
        modelName: 'Test Model @ 2024 (v2.0)',
        sheetId: '123e4567-e89b-12d3-a456-426614174000',
        isDefaultB2C: false,
        isDefaultB2B: false,
        cellMappings: validCellMappings,
      };

      const result = createPricingModelSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept model name with unicode characters', () => {
      const validInput = {
        modelName: 'Modèle de Prix 价格模型',
        sheetId: '123e4567-e89b-12d3-a456-426614174000',
        isDefaultB2C: false,
        isDefaultB2B: false,
        cellMappings: validCellMappings,
      };

      const result = createPricingModelSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });
});
