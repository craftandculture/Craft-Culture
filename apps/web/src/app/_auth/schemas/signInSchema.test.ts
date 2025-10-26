import { describe, expect, it } from 'vitest';

import signInSchema from './signInSchema';

describe('signInSchema', () => {
  describe('valid inputs', () => {
    it('should accept valid email address', () => {
      const validInput = {
        email: 'user@example.com',
      };

      const result = signInSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('user@example.com');
      }
    });

    it('should transform uppercase email to lowercase', () => {
      const validInput = {
        email: 'USER@EXAMPLE.COM',
      };

      const result = signInSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('user@example.com');
      }
    });

    it('should transform mixed-case email to lowercase', () => {
      const validInput = {
        email: 'UsEr@ExAmPlE.CoM',
      };

      const result = signInSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('user@example.com');
      }
    });

    it('should accept email with plus sign', () => {
      const validInput = {
        email: 'user+tag@example.com',
      };

      const result = signInSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('user+tag@example.com');
      }
    });

    it('should accept email with subdomain', () => {
      const validInput = {
        email: 'user@mail.example.com',
      };

      const result = signInSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('user@mail.example.com');
      }
    });

    it('should accept email with numbers', () => {
      const validInput = {
        email: 'user123@example456.com',
      };

      const result = signInSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('user123@example456.com');
      }
    });

    it('should accept email with dots in local part', () => {
      const validInput = {
        email: 'first.last@example.com',
      };

      const result = signInSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('first.last@example.com');
      }
    });

    it('should accept email with hyphens in domain', () => {
      const validInput = {
        email: 'user@my-domain.com',
      };

      const result = signInSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('user@my-domain.com');
      }
    });
  });

  describe('invalid inputs', () => {
    it('should reject email without @ symbol', () => {
      const invalidInput = {
        email: 'userexample.com',
      };

      const result = signInSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject email without domain', () => {
      const invalidInput = {
        email: 'user@',
      };

      const result = signInSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject email without local part', () => {
      const invalidInput = {
        email: '@example.com',
      };

      const result = signInSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject email without TLD', () => {
      const invalidInput = {
        email: 'user@example',
      };

      const result = signInSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject empty email', () => {
      const invalidInput = {
        email: '',
      };

      const result = signInSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject email with spaces', () => {
      const invalidInput = {
        email: 'user @example.com',
      };

      const result = signInSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject email with multiple @ symbols', () => {
      const invalidInput = {
        email: 'user@@example.com',
      };

      const result = signInSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject missing email field', () => {
      const invalidInput = {};

      const result = signInSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject non-string email', () => {
      const invalidInput = {
        email: 12345,
      };

      const result = signInSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject null email', () => {
      const invalidInput = {
        email: null,
      };

      const result = signInSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle email with trailing whitespace', () => {
      const validInput = {
        email: 'user@example.com ',
      };

      // Zod email validator might trim or reject
      const result = signInSchema.safeParse(validInput);
      // Email with trailing space is technically invalid
      expect(result.success).toBe(false);
    });

    it('should handle email with leading whitespace', () => {
      const validInput = {
        email: ' user@example.com',
      };

      const result = signInSchema.safeParse(validInput);
      // Email with leading space is technically invalid
      expect(result.success).toBe(false);
    });

    it('should accept very long email', () => {
      const longLocalPart = 'a'.repeat(64);
      const validInput = {
        email: `${longLocalPart}@example.com`,
      };

      const result = signInSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept email with various special characters in local part', () => {
      const validInput = {
        email: 'user_name-test.email+tag@example.com',
      };

      const result = signInSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('user_name-test.email+tag@example.com');
      }
    });
  });

  describe('transformation behavior', () => {
    it('should preserve valid lowercase email', () => {
      const validInput = {
        email: 'already@lowercase.com',
      };

      const result = signInSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('already@lowercase.com');
      }
    });

    it('should transform only email part, not affect validation', () => {
      const validInput = {
        email: 'TEST@UPPERCASE.COM',
      };

      const result = signInSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        // Both local and domain parts should be lowercase
        expect(result.data.email).toBe('test@uppercase.com');
        expect(result.data.email).not.toContain('TEST');
        expect(result.data.email).not.toContain('UPPERCASE');
      }
    });
  });
});
