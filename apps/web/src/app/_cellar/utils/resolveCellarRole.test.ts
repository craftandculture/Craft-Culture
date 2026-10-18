import { describe, expect, it } from 'vitest';

import resolveCellarRole from './resolveCellarRole';

describe('resolveCellarRole', () => {
  it('treats someone with no grant as the holder', () => {
    expect(resolveCellarRole([])).toBe('holder');
  });

  it('gives a delegate the role on their active grant', () => {
    expect(resolveCellarRole([{ role: 'manager', status: 'active' }])).toBe(
      'manager',
    );
    expect(resolveCellarRole([{ role: 'viewer', status: 'active' }])).toBe(
      'viewer',
    );
  });

  it('ends access once every grant is revoked', () => {
    expect(resolveCellarRole([{ role: 'manager', status: 'revoked' }])).toBe(
      'revoked',
    );
  });

  it('honours a later grant after an earlier one was revoked', () => {
    expect(
      resolveCellarRole([
        { role: 'manager', status: 'revoked' },
        { role: 'viewer', status: 'active' },
      ]),
    ).toBe('viewer');
  });

  it('ignores invitations not yet accepted', () => {
    expect(resolveCellarRole([{ role: 'manager', status: 'invited' }])).toBe(
      'holder',
    );
  });

  it('reads an unknown role as a viewer', () => {
    expect(resolveCellarRole([{ role: 'owner', status: 'active' }])).toBe(
      'viewer',
    );
  });
});
