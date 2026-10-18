import { describe, expect, it } from 'vitest';

import type { CellarReleaseDeliveryDetails } from '@/database/schema';

import buildReleaseDeliveryNotes from './buildReleaseDeliveryNotes';
import describePreferredDelivery from './describePreferredDelivery';

const details = (
  overrides: Partial<CellarReleaseDeliveryDetails> = {},
): CellarReleaseDeliveryDetails => ({
  requestId: '00000000-0000-0000-0000-000000000000',
  addressId: null,
  addressLabel: null,
  deliveryInstructions: null,
  preferredDate: null,
  preferredWindow: null,
  isGift: false,
  recipientName: null,
  recipientPhone: null,
  giftMessage: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('describePreferredDelivery', () => {
  it('names the day and the window', () => {
    expect(describePreferredDelivery('2026-10-21', 'morning')).toBe(
      'Wed 21 Oct, morning',
    );
  });

  it('treats any time as no window', () => {
    expect(describePreferredDelivery('2026-10-21', 'any')).toBe('Wed 21 Oct');
  });

  it('says any day when only a window is given', () => {
    expect(describePreferredDelivery(null, 'afternoon')).toBe(
      'Any day, afternoon',
    );
  });

  it('returns null with no preference', () => {
    expect(describePreferredDelivery(null, 'any')).toBeNull();
    expect(describePreferredDelivery(undefined, undefined)).toBeNull();
  });
});

describe('buildReleaseDeliveryNotes', () => {
  it('returns null when there is nothing to say', () => {
    expect(
      buildReleaseDeliveryNotes({
        memberNotes: null,
        details: undefined,
        memberName: 'A Member',
      }),
    ).toBeNull();
  });

  it('keeps the member notes on their own', () => {
    expect(
      buildReleaseDeliveryNotes({
        memberNotes: ' Ring first ',
        details: undefined,
        memberName: 'A Member',
      }),
    ).toBe('Member notes: Ring first');
  });

  it('carries the preference as unconfirmed', () => {
    const notes = buildReleaseDeliveryNotes({
      memberNotes: null,
      details: details({ preferredDate: '2026-10-21', preferredWindow: 'morning' }),
      memberName: 'A Member',
    });

    expect(notes).toContain('Wed 21 Oct, morning (to be confirmed)');
  });

  it('flags a gift with the recipient, the ID check and the message', () => {
    const notes = buildReleaseDeliveryNotes({
      memberNotes: null,
      details: details({
        isGift: true,
        recipientName: 'Sara',
        recipientPhone: '+971500000000',
        giftMessage: 'Happy birthday',
      }),
      memberName: 'A Member',
    });

    expect(notes).toContain('GIFT from A Member to Sara (+971500000000)');
    expect(notes).toContain('21 or over');
    expect(notes).toContain('Gift message: "Happy birthday"');
  });
});
