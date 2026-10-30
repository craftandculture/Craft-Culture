import { describe, expect, it } from 'vitest';

import orderEmailCopy from './orderEmailCopy';
import { buildOrderDigestEmail, isDigestUpdate, nextDigestAt } from './orderEmailDigest';
import type { OrderEmailEvent, OrderEmailSnapshot, OrderStatus } from './orderEmailTypes';

const order = (orderNumber: string, status: OrderStatus, clientName = 'Ahmed Al Mansoori'): OrderEmailSnapshot => ({
  id: orderNumber,
  orderNumber,
  status,
  clientName,
  clientEmail: null,
  clientPhone: null,
  distributorName: 'City Drinks',
  paymentReference: null,
  totalUsd: 1000,
  scheduledDeliveryDate: null,
  deliveredAt: new Date('2026-10-28T08:00:00Z'),
  revisionReason: null,
  cancellationReason: null,
  distributorVerificationNotes: null,
  items: [],
  history: [],
});

const event = (newStatus: OrderStatus, action = 'status_changed'): OrderEmailEvent => ({
  action,
  newStatus,
  previousStatus: 'out_for_delivery',
  notes: null,
  at: new Date('2026-10-28T08:00:00Z'),
});

describe('nextDigestAt', () => {
  it('is 17:00 Gulf time the same day before then', () => {
    expect(nextDigestAt(new Date('2026-10-30T09:00:00Z')).toISOString()).toBe('2026-10-30T13:00:00.000Z');
  });

  it('is the next day once 17:00 has passed', () => {
    expect(nextDigestAt(new Date('2026-10-30T13:00:00Z')).toISOString()).toBe('2026-10-31T13:00:00.000Z');
    expect(nextDigestAt(new Date('2026-10-30T22:30:00Z')).toISOString()).toBe('2026-10-31T13:00:00.000Z');
  });
});

describe('isDigestUpdate', () => {
  const o = order('PCO-2026-00061', 'delivered');
  const check = (e: OrderEmailEvent, audience: 'partner' | 'distributor' = 'partner') => {
    const copy = orderEmailCopy(e, audience, o);
    return copy ? isDigestUpdate(e, audience, copy) : null;
  };

  it('holds a partner milestone for the summary', () => {
    expect(check(event('delivered'))).toBe(true);
  });

  it('sends cancellations, changes requested and notes straight away', () => {
    expect(check(event('cancelled'))).toBe(false);
    expect(check(event('revision_requested'))).toBe(false);
    expect(check({ ...event('delivered', 'note_added'), newStatus: null, notes: 'Hello' })).toBe(false);
  });

  it('never holds a distributor email', () => {
    expect(check(event('cancelled'), 'distributor')).toBe(false);
  });
});

describe('buildOrderDigestEmail', () => {
  it('lists each order with where it stands', () => {
    const data = buildOrderDigestEmail(
      [
        { event: event('delivered'), order: order('PCO-2026-00061', 'delivered') },
        { event: event('delivered'), order: order('PCO-2026-00062', 'delivered', 'Sara Haddad') },
      ],
      'https://example.test/platform/private-orders',
      'Gemma',
      new Date('2026-10-28T13:00:00Z'),
    );

    expect(data.subject).toBe('Your order updates today: 2 orders');
    expect(data.rows).toEqual([
      { label: 'PCO-2026-00061', value: 'Delivered · Ahmed Al Mansoori' },
      { label: 'PCO-2026-00062', value: 'Delivered · Sara Haddad' },
    ]);
    expect(data.steps).toEqual([]);
    expect(data.ctaUrl).toBe('https://example.test/platform/private-orders');
  });
});
