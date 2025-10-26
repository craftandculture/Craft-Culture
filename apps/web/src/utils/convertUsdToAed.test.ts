import { describe, expect, it } from 'vitest';

import convertUsdToAed from './convertUsdToAed';

describe('convertUsdToAed', () => {
  it('should convert USD to AED using 3.67 rate', () => {
    const result = convertUsdToAed(100);
    expect(result).toBe(367);
  });

  it('should handle zero amount', () => {
    const result = convertUsdToAed(0);
    expect(result).toBe(0);
  });

  it('should handle decimal amounts', () => {
    const result = convertUsdToAed(10.5);
    expect(result).toBe(38.535);
  });

  it('should handle negative amounts', () => {
    const result = convertUsdToAed(-100);
    expect(result).toBe(-367);
  });

  it('should handle very small amounts', () => {
    const result = convertUsdToAed(0.01);
    expect(result).toBe(0.0367);
  });

  it('should handle very large amounts', () => {
    const result = convertUsdToAed(1000000);
    expect(result).toBe(3670000);
  });

  it('should maintain precision for typical quote amounts', () => {
    const result = convertUsdToAed(1234.56);
    expect(result).toBeCloseTo(4530.8352, 2);
  });

  it('should convert $1 to 3.67 AED', () => {
    const result = convertUsdToAed(1);
    expect(result).toBe(3.67);
  });
});
