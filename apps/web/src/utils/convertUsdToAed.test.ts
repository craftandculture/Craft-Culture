import { describe, expect, it } from 'vitest';

import convertUsdToAed from './convertUsdToAed';

describe('convertUsdToAed', () => {
  it('should convert USD to AED at the 3.6725 peg', () => {
    const result = convertUsdToAed(100);
    expect(result).toBeCloseTo(367.25, 10);
  });

  it('should handle zero amount', () => {
    const result = convertUsdToAed(0);
    expect(result).toBe(0);
  });

  it('should handle decimal amounts', () => {
    const result = convertUsdToAed(10.5);
    expect(result).toBeCloseTo(38.56125, 10);
  });

  it('should handle negative amounts', () => {
    const result = convertUsdToAed(-100);
    expect(result).toBeCloseTo(-367.25, 10);
  });

  it('should handle very small amounts', () => {
    const result = convertUsdToAed(0.01);
    expect(result).toBeCloseTo(0.036725, 10);
  });

  it('should handle very large amounts', () => {
    const result = convertUsdToAed(1000000);
    expect(result).toBeCloseTo(3672500, 6);
  });

  it('should maintain precision for typical quote amounts', () => {
    const result = convertUsdToAed(1234.56);
    expect(result).toBeCloseTo(4533.9216, 2);
  });

  it('should convert $1 to 3.6725 AED', () => {
    const result = convertUsdToAed(1);
    expect(result).toBe(3.6725);
  });

  it('should match PCO-2026-00105: USD 1,270.83 is AED 4,667.12', () => {
    expect(convertUsdToAed(1270.83)).toBeCloseTo(4667.12, 2);
  });
});
