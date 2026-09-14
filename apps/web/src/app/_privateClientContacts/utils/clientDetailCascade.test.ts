import { describe, expect, it } from 'vitest';

import buildOrderClientPatch, { OPEN_ORDER_STATUSES } from './clientDetailCascade';

describe('buildOrderClientPatch', () => {
  it('carries a corrected phone number onto the order', () => {
    // The distributor portal reads the order's copy, not the client record.
    expect(buildOrderClientPatch({ phone: '+971 56 111 5666' })).toEqual({
      clientPhone: '+971 56 111 5666',
    });
  });

  it('leaves untouched fields alone', () => {
    const patch = buildOrderClientPatch({ phone: '+971 56 111 5666' });

    // Editing a phone number must not blank the name or the address.
    expect(patch).not.toHaveProperty('clientName');
    expect(patch).not.toHaveProperty('clientEmail');
    expect(patch).not.toHaveProperty('clientAddress');
  });

  it('treats an empty string as a deliberate clearing', () => {
    expect(buildOrderClientPatch({ email: '' })).toEqual({ clientEmail: null });
  });

  it('rebuilds the order address from every part', () => {
    const patch = buildOrderClientPatch({
      addressLine1: 'Villa 12',
      addressLine2: 'Street 8',
      city: 'Dubai',
      country: 'United Arab Emirates',
    });

    expect(patch.clientAddress).toBe(
      'Villa 12, Street 8, Dubai, United Arab Emirates',
    );
  });

  it('rewrites the address when only one part changes', () => {
    // The order holds one line, so a changed city has to rebuild the whole of it.
    const patch = buildOrderClientPatch({ city: 'Abu Dhabi' });

    expect(patch.clientAddress).toBe('Abu Dhabi');
  });

  it('clears the address when every part is cleared', () => {
    expect(
      buildOrderClientPatch({ addressLine1: '', city: '', country: '' })
        .clientAddress,
    ).toBeNull();
  });

  it('returns nothing when the edit touches no copied field', () => {
    // Preferences and notes live only on the client record.
    expect(buildOrderClientPatch({})).toEqual({});
  });

  it('never cascades to a delivered or cancelled order', () => {
    expect(OPEN_ORDER_STATUSES).not.toContain('delivered');
    expect(OPEN_ORDER_STATUSES).not.toContain('cancelled');
  });

  it('does cascade to orders still in flight', () => {
    for (const status of [
      'draft',
      'awaiting_partner_verification',
      'awaiting_client_payment',
      'out_for_delivery',
    ]) {
      expect(OPEN_ORDER_STATUSES).toContain(status);
    }
  });
});
