import { describe, expect, it } from 'vitest';

import labelOwnerText, { HIDDEN_OWNER_FALLBACK } from './labelOwnerText';

const hidden = [
  { partnerId: 'p-ihab', name: 'Ihab Toma', code: 'PC-1001' },
  { partnerId: 'p-new', name: 'New Member', code: null },
];

describe('labelOwnerText', () => {
  it('prints a private client’s reference instead of their name', () => {
    expect(labelOwnerText({ id: 'p-ihab', name: 'Ihab Toma' }, hidden)).toBe(
      'PC-1001',
    );
  });

  it('matches on the name when the caller has no id', () => {
    expect(labelOwnerText({ name: '  ihab toma ' }, hidden)).toBe('PC-1001');
  });

  it('prints trade owners by name', () => {
    expect(labelOwnerText({ id: 'p-cru', name: 'Cru Wine' }, hidden)).toBe(
      'Cru Wine',
    );
  });

  it('falls back to PRIVATE CLIENT, never the name, when no code exists', () => {
    expect(labelOwnerText({ name: 'New Member' }, hidden)).toBe(
      HIDDEN_OWNER_FALLBACK,
    );
  });

  it('hides every owner when the hidden list could not be loaded', () => {
    expect(labelOwnerText({ name: 'Cru Wine' }, null)).toBe(
      HIDDEN_OWNER_FALLBACK,
    );
  });

  it('leaves an owner-less label without an owner', () => {
    expect(labelOwnerText({}, hidden)).toBeUndefined();
  });
});
