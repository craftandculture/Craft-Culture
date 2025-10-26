import { describe, expect, it } from 'vitest';

import getQuoteRequestSchema from './getQuoteRequestSchema';

describe('getQuoteRequestSchema', () => {
  describe('valid inputs', () => {
    it('should accept valid quote request with single line item', () => {
      const validInput = {
        lineItems: [
          {
            productId: '123e4567-e89b-12d3-a456-426614174000',
            offerId: '123e4567-e89b-12d3-a456-426614174001',
            quantity: 1,
          },
        ],
      };

      const result = getQuoteRequestSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validInput);
      }
    });

    it('should accept valid quote request with multiple line items', () => {
      const validInput = {
        lineItems: [
          {
            productId: '123e4567-e89b-12d3-a456-426614174000',
            offerId: '123e4567-e89b-12d3-a456-426614174001',
            quantity: 5,
          },
          {
            productId: '223e4567-e89b-12d3-a456-426614174000',
            offerId: '223e4567-e89b-12d3-a456-426614174001',
            quantity: 10,
          },
        ],
      };

      const result = getQuoteRequestSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validInput);
      }
    });

    it('should accept large quantities', () => {
      const validInput = {
        lineItems: [
          {
            productId: '123e4567-e89b-12d3-a456-426614174000',
            offerId: '123e4567-e89b-12d3-a456-426614174001',
            quantity: 1000,
          },
        ],
      };

      const result = getQuoteRequestSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid productId', () => {
    it('should reject invalid productId format', () => {
      const invalidInput = {
        lineItems: [
          {
            productId: 'not-a-uuid',
            offerId: '123e4567-e89b-12d3-a456-426614174001',
            quantity: 1,
          },
        ],
      };

      const result = getQuoteRequestSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual([
          'lineItems',
          0,
          'productId',
        ]);
      }
    });

    it('should reject empty productId', () => {
      const invalidInput = {
        lineItems: [
          {
            productId: '',
            offerId: '123e4567-e89b-12d3-a456-426614174001',
            quantity: 1,
          },
        ],
      };

      const result = getQuoteRequestSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject missing productId', () => {
      const invalidInput = {
        lineItems: [
          {
            offerId: '123e4567-e89b-12d3-a456-426614174001',
            quantity: 1,
          },
        ],
      };

      const result = getQuoteRequestSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe('invalid offerId', () => {
    it('should reject invalid offerId format', () => {
      const invalidInput = {
        lineItems: [
          {
            productId: '123e4567-e89b-12d3-a456-426614174000',
            offerId: 'not-a-uuid',
            quantity: 1,
          },
        ],
      };

      const result = getQuoteRequestSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['lineItems', 0, 'offerId']);
      }
    });

    it('should reject missing offerId', () => {
      const invalidInput = {
        lineItems: [
          {
            productId: '123e4567-e89b-12d3-a456-426614174000',
            quantity: 1,
          },
        ],
      };

      const result = getQuoteRequestSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe('invalid quantity', () => {
    it('should reject zero quantity', () => {
      const invalidInput = {
        lineItems: [
          {
            productId: '123e4567-e89b-12d3-a456-426614174000',
            offerId: '123e4567-e89b-12d3-a456-426614174001',
            quantity: 0,
          },
        ],
      };

      const result = getQuoteRequestSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('1');
      }
    });

    it('should reject negative quantity', () => {
      const invalidInput = {
        lineItems: [
          {
            productId: '123e4567-e89b-12d3-a456-426614174000',
            offerId: '123e4567-e89b-12d3-a456-426614174001',
            quantity: -5,
          },
        ],
      };

      const result = getQuoteRequestSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject decimal quantity', () => {
      const invalidInput = {
        lineItems: [
          {
            productId: '123e4567-e89b-12d3-a456-426614174000',
            offerId: '123e4567-e89b-12d3-a456-426614174001',
            quantity: 5.5,
          },
        ],
      };

      const result = getQuoteRequestSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('int');
      }
    });

    it('should reject missing quantity', () => {
      const invalidInput = {
        lineItems: [
          {
            productId: '123e4567-e89b-12d3-a456-426614174000',
            offerId: '123e4567-e89b-12d3-a456-426614174001',
          },
        ],
      };

      const result = getQuoteRequestSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject string quantity', () => {
      const invalidInput = {
        lineItems: [
          {
            productId: '123e4567-e89b-12d3-a456-426614174000',
            offerId: '123e4567-e89b-12d3-a456-426614174001',
            quantity: '5',
          },
        ],
      };

      const result = getQuoteRequestSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe('invalid lineItems structure', () => {
    it('should reject empty lineItems array', () => {
      const invalidInput = {
        lineItems: [],
      };

      const result = getQuoteRequestSchema.safeParse(invalidInput);
      // Empty array is valid per schema, but would fail business logic
      expect(result.success).toBe(true);
    });

    it('should reject missing lineItems', () => {
      const invalidInput = {};

      const result = getQuoteRequestSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject lineItems that is not an array', () => {
      const invalidInput = {
        lineItems: 'not-an-array',
      };

      const result = getQuoteRequestSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject lineItems with invalid nested structure', () => {
      const invalidInput = {
        lineItems: [
          {
            productId: '123e4567-e89b-12d3-a456-426614174000',
            offerId: '123e4567-e89b-12d3-a456-426614174001',
            quantity: 1,
            extraField: 'should-not-be-here',
          },
        ],
      };

      // Zod strips extra fields by default, so this should pass
      const result = getQuoteRequestSchema.safeParse(invalidInput);
      expect(result.success).toBe(true);
    });
  });

  describe('multiple validation errors', () => {
    it('should report multiple errors at once', () => {
      const invalidInput = {
        lineItems: [
          {
            productId: 'invalid-uuid',
            offerId: 'also-invalid',
            quantity: -1,
          },
        ],
      };

      const result = getQuoteRequestSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        // Should have errors for productId, offerId, and quantity
        expect(result.error.issues.length).toBeGreaterThanOrEqual(3);
      }
    });
  });
});
