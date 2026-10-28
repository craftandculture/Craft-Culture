import { describe, expect, it } from 'vitest';

import buildOrderEmail from './buildOrderEmail';
import groupOrderEmails from './groupOrderEmails';
import type { OrderEmailEvent, OrderEmailSnapshot, OrderStatus } from './orderEmailTypes';

const at = (day: number) => new Date(Date.UTC(2026, 9, day, 8));

const order = (over: Partial<OrderEmailSnapshot> = {}): OrderEmailSnapshot => ({
  id: 'o1',
  orderNumber: 'PCO-2026-00061',
  status: 'awaiting_partner_verification',
  clientName: 'Ahmed Al Mansoori',
  clientEmail: 'ahmed@example.com',
  clientPhone: '+971 50 123 4567',
  distributorName: 'City Drinks',
  paymentReference: null,
  totalUsd: 12480,
  scheduledDeliveryDate: null,
  deliveredAt: null,
  revisionReason: null,
  cancellationReason: null,
  distributorVerificationNotes: null,
  items: [
    { productName: 'Sassicaia', vintage: '2016', region: 'Bolgheri', bottleSize: '75cl', caseConfig: 6, quantity: 2 },
    { productName: 'Krug Grande Cuvée', vintage: null, region: 'Champagne', bottleSize: null, caseConfig: 1, quantity: 6 },
  ],
  history: [
    { status: 'submitted', at: at(26) },
    { status: 'cc_approved', at: at(27) },
    { status: 'awaiting_partner_verification', at: at(27) },
  ],
  ...over,
});

const event = (newStatus: OrderStatus | null, over: Partial<OrderEmailEvent> = {}): OrderEmailEvent => ({
  action: 'status_changed',
  newStatus,
  previousStatus: 'cc_approved',
  notes: null,
  at: at(27),
  ...over,
});

const links = { orderUrl: 'https://wine.craftculture.xyz/platform/private-orders/o1', proformaUrl: 'https://x/p' };

describe('buildOrderEmail', () => {
  it('asks the partner to confirm their client, naming the distributor', () => {
    const email = buildOrderEmail(event('awaiting_partner_verification'), 'partner', order(), links, 'Laraine');
    expect(email?.isAction).toBe(true);
    expect(email?.data.action).toEqual([{ text: 'Confirm whether Ahmed Al Mansoori is registered with City Drinks.' }]);
    expect(email?.data.ctaUrl).toBe(links.orderUrl);
    expect(email?.data.label).toBe('PCO-2026-00061');
  });

  it('marks the steps done with their dates and the next one as current', () => {
    const steps = buildOrderEmail(event('awaiting_partner_verification'), 'partner', order(), links, 'L')!.data.steps;
    expect(steps.map((s) => s.mark)).toEqual(['✓', '✓', '→', '○', '○', '○']);
    expect(steps[0]).toEqual({ mark: '✓', label: 'Submitted', when: 'Mon 26 Oct' });
  });

  it('lists the wines as people say them, with the bottle count in the title', () => {
    const data = buildOrderEmail(event('awaiting_partner_verification'), 'partner', order(), links, 'L')!.data;
    expect(data.winesTitle).toEqual([{ title: 'In this order · 2 wines · 18 bottles' }]);
    expect(data.wines[0]).toEqual({ name: 'Sassicaia 2016', detail: 'Bolgheri · Case of 6 × 75cl', quantity: '2 cases' });
    expect(data.wines[1]?.quantity).toBe('6 bottles');
  });

  it('caps the list at eight wines and counts the rest', () => {
    const items = Array.from({ length: 11 }, (_, i) => ({
      productName: `Wine ${i}`, vintage: null, region: null, bottleSize: null, caseConfig: 6, quantity: 1,
    }));
    const data = buildOrderEmail(event('awaiting_partner_verification'), 'partner', order({ items }), links, 'L')!.data;
    expect(data.wines).toHaveLength(8);
    expect(data.winesMore).toEqual([{ text: 'And 3 more wines, 18 bottles. The full list is on the order.' }]);
  });

  it('leaves out empty blocks rather than showing blanks', () => {
    const data = buildOrderEmail(event('cc_approved', { previousStatus: 'under_cc_review' }), 'partner', order({ status: 'cc_approved' }), links, 'L')!.data;
    expect(data.action).toEqual([]);
    expect(data.note).toEqual([]);
    expect(data.secondary).toEqual([]);
    expect(data.rows.map((r) => r.label)).toEqual(['Order', 'Client', 'Distributor', 'Order total']);
  });

  it('carries the revision reason as a note', () => {
    const data = buildOrderEmail(
      event('revision_requested'),
      'partner',
      order({ status: 'revision_requested', revisionReason: 'Please correct the Sassicaia quantity.' }),
      links,
      'L',
    )!.data;
    expect(data.note).toEqual([{ title: 'Our note', text: 'Please correct the Sassicaia quantity.' }]);
  });

  it('gives the distributor the client contact and the proforma on a new order', () => {
    const email = buildOrderEmail(
      event('awaiting_client_payment', { previousStatus: 'cc_approved' }),
      'distributor',
      order({ status: 'awaiting_client_payment', paymentReference: 'CCPC0061' }),
      links,
      'Rashid',
    )!;
    expect(email.data.headline).toBe('A new order has been assigned to you');
    expect(email.data.secondary).toHaveLength(1);
    expect(email.data.rows.map((r) => r.label)).toContain('Mobile');
    expect(email.data.rows.map((r) => r.label)).not.toContain('Distributor');
  });

  it('says nothing to a party for a step that is not theirs', () => {
    expect(buildOrderEmail(event('scheduling_delivery'), 'partner', order(), links, 'L')).toBeNull();
    expect(buildOrderEmail(event('cc_approved'), 'distributor', order(), links, 'L')).toBeNull();
    expect(buildOrderEmail(event('delivered', { previousStatus: 'delivered' }), 'partner', order(), links, 'L')).toBeNull();
  });

  it('keeps a cancelled order’s steps without a current one', () => {
    const steps = buildOrderEmail(event('cancelled'), 'partner', order({ status: 'cancelled' }), links, 'L')!.data.steps;
    expect(steps.map((s) => s.mark)).toEqual(['✓', '✓', '○', '○', '○', '○']);
  });
});

describe('groupOrderEmails', () => {
  const row = (id: string, eventName: string, isAction: boolean, minute: number, email = 'a@x.com') => ({
    id,
    orderId: 'o1',
    recipientEmail: email,
    event: eventName,
    isAction,
    sendAt: new Date(Date.UTC(2026, 9, 27, 8, minute)),
    createdAt: new Date(Date.UTC(2026, 9, 27, 8, minute)),
  });

  it('sends approval and the request to confirm the client as one email asking to act', () => {
    const [group] = groupOrderEmails(
      [row('1', 'cc_approved', false, 0), row('2', 'awaiting_partner_verification', true, 1)],
      () => 'awaiting_partner_verification',
    );
    expect(group?.carrier?.id).toBe('2');
    expect(group?.merged.map((r) => r.id)).toEqual(['1']);
  });

  it('drops a request the order has already moved past', () => {
    const [group] = groupOrderEmails([row('1', 'awaiting_payment_verification', true, 0)], () => 'client_paid');
    expect(group?.carrier).toBeNull();
  });

  it('keeps each recipient and each note separate', () => {
    const groups = groupOrderEmails(
      [row('1', 'delivered', false, 0), row('2', 'delivered', false, 0, 'b@x.com'), row('3', 'note_added', false, 0), row('4', 'note_added', false, 1)],
      () => 'delivered',
    );
    expect(groups).toHaveLength(4);
  });
});
