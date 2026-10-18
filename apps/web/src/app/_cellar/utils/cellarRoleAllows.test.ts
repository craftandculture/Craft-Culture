import { describe, expect, it } from 'vitest';

import cellarRoleAllows from './cellarRoleAllows';

describe('cellarRoleAllows', () => {
  it('lets everyone with access look', () => {
    expect(cellarRoleAllows('holder', 'view')).toBe(true);
    expect(cellarRoleAllows('manager', 'view')).toBe(true);
    expect(cellarRoleAllows('viewer', 'view')).toBe(true);
  });

  it('lets the holder and a manager act, never a viewer', () => {
    expect(cellarRoleAllows('holder', 'act')).toBe(true);
    expect(cellarRoleAllows('manager', 'act')).toBe(true);
    expect(cellarRoleAllows('viewer', 'act')).toBe(false);
  });

  it("keeps the holder's own affairs to the holder", () => {
    expect(cellarRoleAllows('holder', 'hold')).toBe(true);
    expect(cellarRoleAllows('manager', 'hold')).toBe(false);
    expect(cellarRoleAllows('viewer', 'hold')).toBe(false);
  });
});
