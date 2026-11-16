import { describe, expect, it } from 'vitest';

import formatOrderFeedLine from './formatOrderFeedLine';
import type { OrderFeedEvent } from './formatOrderFeedLine';

const event = (over: Partial<OrderFeedEvent> = {}): OrderFeedEvent => ({
  kind: 'activity',
  action: 'status_changed',
  previousStatus: 'delivery_scheduled',
  newStatus: 'delivered',
  orderNumber: 'PCO-2026-00111',
  clientName: 'Michael Humphreys-Davies',
  partnerName: 'Private Cellar',
  totalUsd: 1490.5,
  byName: 'Laraine Alcantara',
  scheduledDate: null,
  notes: null,
  url: 'https://wine.craftculture.xyz/platform/admin/private-orders/abc',
  ...over,
});

describe('formatOrderFeedLine', () => {
  it('leads with the new status, then the order, client, partner and who', () => {
    expect(formatOrderFeedLine(event())).toBe(
      '*Delivered* · <https://wine.craftculture.xyz/platform/admin/private-orders/abc|PCO-2026-00111> · Michael Humphreys-Davies · via Private Cellar · by Laraine',
    );
  });

  it('shows the value on a new order only', () => {
    expect(formatOrderFeedLine(event({ kind: 'created', action: null, previousStatus: null, newStatus: 'submitted' }))).toContain(
      '*New order* ·',
    );
    expect(formatOrderFeedLine(event({ kind: 'created', action: null, newStatus: 'submitted' }))).toContain('$1,491');
    expect(formatOrderFeedLine(event())).not.toContain('$');
  });

  it('says when a delivery is booked for', () => {
    expect(
      formatOrderFeedLine(
        event({ newStatus: 'delivery_scheduled', previousStatus: 'scheduling_delivery', scheduledDate: '2026-11-18T08:00:00.000Z' }),
      ),
    ).toContain('*Delivery booked for Wed 18 Nov*');
  });

  it('quotes the reason when an order is sent back', () => {
    expect(
      formatOrderFeedLine(event({ action: 'revision_requested', newStatus: 'revision_requested', notes: 'Wrong vintage' })),
    ).toContain('\n> Wrong vintage');
  });

  it('skips edits that do not move the order', () => {
    expect(formatOrderFeedLine(event({ action: 'notes_updated', newStatus: null, previousStatus: null }))).toBeNull();
    expect(formatOrderFeedLine(event({ action: 'pricing_updated', newStatus: 'cc_approved', previousStatus: 'cc_approved' }))).toBeNull();
  });
});
