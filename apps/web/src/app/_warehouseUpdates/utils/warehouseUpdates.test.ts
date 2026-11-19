import { describe, expect, it } from 'vitest';

import buildPickedEmail from './buildPickedEmail';
import buildReadyEmail from './buildReadyEmail';
import buildSummaryEmail from './buildSummaryEmail';
import isLogisticsRole from './isLogisticsRole';
import isSummaryTime from './isSummaryTime';
import nextPickedSlot from './nextPickedSlot';
import parseWarehouseUpdatePartners from './parseWarehouseUpdatePartners';
import summariseOpenOrders from './summariseOpenOrders';
import summarisePickLines from './summarisePickLines';
import type { WarehouseUpdateOrder } from '../types';

// Gulf time is UTC+4: 2026-11-19 is a Thursday, 2026-11-22 a Sunday
const gulf = (iso: string) => new Date(`${iso}+04:00`);

const order = (id: string, label = `SO-${id}`): WarehouseUpdateOrder => ({ orderId: id, label, reference: null, client: null });

describe('nextPickedSlot', () => {
  it('sends a morning pick at 11:00', () => {
    expect(nextPickedSlot(gulf('2026-11-19T09:15:00'))).toEqual(gulf('2026-11-19T11:00:00'));
  });

  it('sends a midday pick at 16:00', () => {
    expect(nextPickedSlot(gulf('2026-11-19T11:00:00'))).toEqual(gulf('2026-11-19T16:00:00'));
  });

  it('holds an evening pick for 11:00 the next working day', () => {
    expect(nextPickedSlot(gulf('2026-11-19T18:30:00'))).toEqual(gulf('2026-11-20T11:00:00'));
  });

  it('skips Sunday', () => {
    expect(nextPickedSlot(gulf('2026-11-21T17:00:00'))).toEqual(gulf('2026-11-23T11:00:00'));
  });
});

describe('isSummaryTime', () => {
  it('is due from 17:00 to 19:59 Gulf time, not on Sunday', () => {
    expect(isSummaryTime(gulf('2026-11-19T16:59:00'))).toBe(false);
    expect(isSummaryTime(gulf('2026-11-19T17:00:00'))).toBe(true);
    expect(isSummaryTime(gulf('2026-11-19T19:59:00'))).toBe(true);
    expect(isSummaryTime(gulf('2026-11-19T20:00:00'))).toBe(false);
    expect(isSummaryTime(gulf('2026-11-22T17:30:00'))).toBe(false);
  });
});

describe('parseWarehouseUpdatePartners', () => {
  it('reads each distributor, defaulting to grouped with a summary', () => {
    const prefs = parseWarehouseUpdatePartners(JSON.stringify({ a: {}, b: { picked: 'immediate', summary: false } }));
    expect(prefs.get('a')).toEqual({ picked: 'grouped', summary: true });
    expect(prefs.get('b')).toEqual({ picked: 'immediate', summary: false });
  });

  it('sends to nobody on a damaged value', () => {
    expect(parseWarehouseUpdatePartners('not json').size).toBe(0);
    expect(parseWarehouseUpdatePartners(undefined).size).toBe(0);
  });
});

describe('isLogisticsRole', () => {
  it('knows the people who receive goods', () => {
    expect(isLogisticsRole('Logistics')).toBe(true);
    expect(isLogisticsRole('Warehouse supervisor')).toBe(true);
    expect(isLogisticsRole('Receiving')).toBe(true);
    expect(isLogisticsRole('Purchasing')).toBe(false);
    expect(isLogisticsRole(null)).toBe(false);
  });
});

describe('summarisePickLines', () => {
  it('adds cases and loose bottles per wine', () => {
    expect(
      summarisePickLines([
        { name: 'Wine A', cases: 2, bottles: null },
        { name: 'Wine A', cases: 1, bottles: 4 },
        { name: 'Wine B', cases: 1, bottles: null },
      ]),
    ).toEqual({
      lines: [
        { name: 'Wine A', quantity: '2 cases + 4 bottles' },
        { name: 'Wine B', quantity: '1 case' },
      ],
      cases: 3,
      bottles: 4,
    });
  });
});

describe('summariseOpenOrders', () => {
  const dayStart = gulf('2026-11-19T00:00:00');
  const at = (iso: string) => gulf(`2026-11-${iso}`);

  it('places each order at its latest stage', () => {
    const summary = summariseOpenOrders(
      [
        { kind: 'received', createdAt: at('19T08:00:00'), data: { orders: [order('1')] } },
        { kind: 'received', createdAt: at('19T08:00:00'), data: { orders: [order('2')] } },
        { kind: 'picked', createdAt: at('19T10:00:00'), data: { orders: [order('2')] } },
        { kind: 'received', createdAt: at('18T08:00:00'), data: { orders: [order('3')] } },
        { kind: 'ready', createdAt: at('19T14:00:00'), data: { orders: [order('3')] } },
        { kind: 'ready', createdAt: at('18T14:00:00'), data: { orders: [order('4')] } },
      ],
      dayStart,
    );
    expect(summary.picking.map((o) => o.orderId)).toEqual(['1']);
    expect(summary.packed.map((o) => o.orderId)).toEqual(['2']);
    expect(summary.dispatchedToday.map((o) => o.orderId)).toEqual(['3']);
  });

  it('drops a cancelled pick until it is released again', () => {
    const cancelled = summariseOpenOrders(
      [
        { kind: 'received', createdAt: at('19T08:00:00'), data: { orders: [order('1')] } },
        { kind: 'problem', createdAt: at('19T09:00:00'), data: { orders: [order('1')], problem: 'cancelled' } },
      ],
      dayStart,
    );
    expect(cancelled.picking).toEqual([]);

    const again = summariseOpenOrders(
      [
        { kind: 'received', createdAt: at('19T08:00:00'), data: { orders: [order('1')] } },
        { kind: 'problem', createdAt: at('19T09:00:00'), data: { orders: [order('1')], problem: 'cancelled' } },
        { kind: 'received', createdAt: at('19T09:10:00'), data: { orders: [order('1')] } },
      ],
      dayStart,
    );
    expect(again.picking.map((o) => o.orderId)).toEqual(['1']);
  });

  it('keeps an order changed during picking where it was', () => {
    const summary = summariseOpenOrders(
      [
        { kind: 'received', createdAt: at('19T08:00:00'), data: { orders: [order('1')] } },
        { kind: 'problem', createdAt: at('19T09:00:00'), data: { orders: [order('1')], problem: 'changed' } },
      ],
      dayStart,
    );
    expect(summary.picking.map((o) => o.orderId)).toEqual(['1']);
  });
});

describe('emails', () => {
  const filled = (data: Record<string, unknown>) => {
    for (const key of ['subject', 'preheader', 'label', 'eyebrow', 'headline', 'name', 'body', 'ctaLabel', 'ctaUrl']) {
      expect(String(data[key] ?? '').trim(), key).not.toBe('');
    }
  };

  it('lists the wines on a single picked order', () => {
    const email = buildPickedEmail(
      [{ orders: [order('1', 'SO-00412')], lines: [{ name: 'Wine A', quantity: '2 cases' }], cases: 2, bottles: 0 }],
      'Jude ',
    );
    filled(email);
    expect(email.subject).toBe('Picked and packed: SO-00412');
    expect(email.name).toBe('Jude');
    expect(email.wines).toEqual([{ name: 'Wine A', detail: '', quantity: '2 cases' }]);
  });

  it('lists each order on a grouped picked email', () => {
    const email = buildPickedEmail(
      [
        { orders: [order('1')], cases: 2 },
        { orders: [order('2')], bottles: 3 },
      ],
      '',
    );
    filled(email);
    expect(email.name).toBe('Sir or Madam');
    expect(email.subject).toBe('Picked and packed: 2 orders');
    expect(email.rows).toEqual([
      { label: 'SO-1', value: '2 cases' },
      { label: 'SO-2', value: '3 bottles' },
    ]);
  });

  it('links the delivery note when a batch is ready', () => {
    const email = buildReadyEmail(
      {
        orders: [order('1'), order('2')],
        batchNumber: 'BATCH-0042',
        stage: 'staged',
        cases: 12,
        deliveryNoteNumber: 'DN-0042',
        deliveryNoteUrl: 'https://example.com/dn.pdf',
      },
      'Jude',
    );
    filled(email);
    expect(email.subject).toBe('Ready for dispatch: 2 orders');
    expect(email.ctaUrl).toBe('https://example.com/dn.pdf');
    expect(email.rows).toContainEqual({ label: 'Total', value: '12 cases' });
  });

  it('says a batch dispatched without staging has left', () => {
    const email = buildReadyEmail({ orders: [order('1')], stage: 'dispatched' }, 'Jude');
    expect(email.subject).toBe('Dispatched: SO-1');
    expect(email.headline).toBe('Your order has been dispatched');
  });

  it('summarises open orders, packed first', () => {
    const email = buildSummaryEmail({ picking: [order('1')], packed: [order('2')], dispatchedToday: [order('3')] }, 'Jude', 'Thursday 19 November');
    filled(email);
    expect(email.rows.map((r) => r.label)).toEqual(['SO-2', 'SO-1', 'SO-3']);
    expect(email.subject).toBe('Your orders at the C&C warehouse: 1 being picked, 1 packed awaiting dispatch, 1 dispatched today');
  });
});
