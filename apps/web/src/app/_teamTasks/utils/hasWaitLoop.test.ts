import { describe, expect, it } from 'vitest';

import hasWaitLoop from './hasWaitLoop';

const parts = (...waits: (number | null)[]) => waits.map((waitsForIndex) => ({ waitsForIndex }));

describe('hasWaitLoop', () => {
  it('accepts parts that wait for nothing', () => {
    expect(hasWaitLoop(parts(null, null))).toBe(false);
  });

  it('accepts a chain that ends', () => {
    expect(hasWaitLoop(parts(null, 0, 1))).toBe(false);
    expect(hasWaitLoop(parts(2, 2, null))).toBe(false);
  });

  it('rejects two parts waiting for each other', () => {
    expect(hasWaitLoop(parts(1, 0))).toBe(true);
  });

  it('rejects a longer loop', () => {
    expect(hasWaitLoop(parts(1, 2, 0))).toBe(true);
  });

  it('rejects a loop that a waiting part leads into', () => {
    expect(hasWaitLoop(parts(1, 2, 1))).toBe(true);
  });

  it('rejects a part waiting for itself', () => {
    expect(hasWaitLoop(parts(0))).toBe(true);
  });

  it('ignores out-of-range indexes', () => {
    expect(hasWaitLoop(parts(5, -1))).toBe(false);
  });
});
