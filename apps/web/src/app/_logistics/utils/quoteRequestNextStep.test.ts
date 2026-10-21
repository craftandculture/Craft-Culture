import { describe, expect, it } from 'vitest';

import quoteRequestNextStep from './quoteRequestNextStep';
import workingDaysSince from './workingDaysSince';

// Wednesday 21 October 2026, 10:00 Dubai
const now = new Date('2026-10-21T06:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const base = { status: 'pending', recipients: [], quotes: [], clientPriceUsd: null, clientQuotedAt: null };
const asked = (sentAt: Date | null, outcome = 'awaiting', chasedAt: Date | null = null) => ({ sentAt, chasedAt, outcome });

describe('workingDaysSince', () => {
  it('skips the weekend', () => {
    // Friday 16 October to Wednesday 21 October: Monday, Tuesday and Wednesday
    expect(workingDaysSince(new Date('2026-10-16T06:00:00Z'), now)).toBe(3);
  });

  it('counts nothing on the same day', () => expect(workingDaysSince(now, now)).toBe(0));
});

describe('quoteRequestNextStep', () => {
  it('asks for forwarders first', () => expect(quoteRequestNextStep(base, now)).toBe('choose_forwarders'));

  it('wants the request sent once forwarders are chosen', () =>
    expect(quoteRequestNextStep({ ...base, recipients: [asked(null)] }, now)).toBe('send'));

  it('waits, then calls for a chase after three working days', () => {
    expect(quoteRequestNextStep({ ...base, recipients: [asked(daysAgo(1))] }, now)).toBe('awaiting');
    expect(quoteRequestNextStep({ ...base, recipients: [asked(daysAgo(6))] }, now)).toBe('chase');
    expect(quoteRequestNextStep({ ...base, recipients: [asked(daysAgo(6), 'awaiting', daysAgo(1))] }, now)).toBe(
      'awaiting',
    );
  });

  it('moves to pricing once every forwarder asked has answered', () =>
    expect(
      quoteRequestNextStep({ ...base, recipients: [asked(daysAgo(2), 'quoted')], quotes: [{ status: 'pending' }] }, now),
    ).toBe('price'));

  it('follows the client price through to acceptance', () => {
    const quoted = { ...base, recipients: [asked(daysAgo(2), 'quoted')], quotes: [{ status: 'pending' }] };

    expect(quoteRequestNextStep({ ...quoted, clientPriceUsd: 3200 }, now)).toBe('send_price');
    expect(quoteRequestNextStep({ ...quoted, clientPriceUsd: 3200, clientQuotedAt: now }, now)).toBe('accept');
    expect(quoteRequestNextStep({ ...quoted, quotes: [{ status: 'accepted' }] }, now)).toBe('done');
  });
});
