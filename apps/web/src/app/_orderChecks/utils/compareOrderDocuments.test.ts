import { describe, expect, it } from 'vitest';

import compareOrderDocuments from './compareOrderDocuments';
import type { OrderDoc } from './compareOrderDocuments';
import parseTermsDays from './parseTermsDays';

/*
  Centaurus International, LPO 8828 of 19 October 2026, as the client's form,
  SO-00198 and INV-000422 read. The wine is right on every document; the
  paperwork is not, which is the case this check exists for.
*/
const lpo: OrderDoc = {
  kind: 'lpo',
  number: '8828',
  customerName: 'Centaurus International',
  reference: null,
  currency: 'AED',
  total: 2776,
  terms: 'SIXTY (60) DAYS CREDIT TERMS',
  lines: [
    { name: 'Elio Grasso, Barolo, Gavarini Chiniera 75CL 2018', vintage: '2018', sizeMl: 750, pack: 6, bottles: 6, perBottle: 308, lineTotal: 1848 },
    { name: 'Giuseppe Cortese Barbaresco 75CL 2020', vintage: '2020', sizeMl: 750, pack: 6, bottles: 6, perBottle: 154.67, lineTotal: 928 },
  ],
};

const salesOrder: OrderDoc = {
  kind: 'sales_order',
  number: 'SO-00198',
  customerName: 'Centaurus International FZ-LLC',
  reference: 'LPO - 8828',
  currency: 'AED',
  total: 2776,
  terms: null,
  printedText: '***** US Dollar account ***** Bank Name : Emirates NBD … Payment in USD',
  lines: [
    { name: 'Giuseppe Cortese Barbaresco 2020', code: '1234567-2020-06-00750', vintage: '2020', sizeMl: 750, pack: 6, bottles: 6, perBottle: 154.67, lineTotal: 928 },
    { name: 'Elio Grasso, Barolo, Gavarini Chiniera 2018 (6x75cl)', code: '7654321-2018-06-00750', vintage: '2018', sizeMl: 750, pack: 6, bottles: 6, perBottle: 308, lineTotal: 1848 },
  ],
};

const invoice: OrderDoc = {
  ...salesOrder,
  kind: 'invoice',
  number: 'INV-000422',
  reference: 'SO-00198',
  terms: 'Due end of the month',
  printedText: '***** US Dollar account ***** … ***** AED Account *****',
};

describe('compareOrderDocuments', () => {
  it('finds the three paperwork faults on LPO 8828 and agrees the wine', () => {
    const result = compareOrderDocuments({ lpo, salesOrder, invoices: [invoice] });

    expect(result.status).toBe('review');
    expect(result.matched.map((l) => l.vintage)).toEqual(['2018', '2020']);
    expect(result.findings.map((f) => `${f.document}:${f.code}`).sort()).toEqual([
      'Invoice INV-000422:LPO_REF_MISSING',
      'Invoice INV-000422:TERMS_DIFFER',
      'Sales order SO-00198:CURRENCY_WORDING',
    ]);
    expect(result.findings.find((f) => f.code === 'LPO_REF_MISSING')?.level).toBe('error');
  });

  it('is matched once the paperwork is put right', () => {
    const result = compareOrderDocuments({
      lpo,
      salesOrder: { ...salesOrder, printedText: '' },
      invoices: [{ ...invoice, reference: 'LPO 8828', terms: 'Net 60', printedText: '' }],
    });

    expect(result.findings).toEqual([]);
    expect(result.status).toBe('matched');
  });

  it('never calls an order matched while a document is missing', () => {
    const result = compareOrderDocuments({ lpo, salesOrder: { ...salesOrder, printedText: '' }, invoices: [] });

    expect(result.status).toBe('awaiting');
    expect(result.awaiting).toEqual(['Invoice']);
  });

  it('names the line and both figures when a quantity or price differs', () => {
    const shortInvoice: OrderDoc = {
      ...invoice,
      reference: '8828',
      terms: 'Net 60',
      lines: [
        { ...invoice.lines[0]!, perBottle: 150, lineTotal: 900 },
        { ...invoice.lines[1]!, bottles: 12, lineTotal: 3696 },
      ],
      total: 4596,
    };
    const result = compareOrderDocuments({ lpo, salesOrder: { ...salesOrder, printedText: '' }, invoices: [shortInvoice] });
    const codes = result.findings.map((f) => f.code);

    expect(codes).toContain('PRICE_DIFFERS');
    expect(codes).toContain('QTY_DIFFERS');
    expect(codes).toContain('TOTAL_DIFFERS');
    expect(result.findings.find((f) => f.code === 'QTY_DIFFERS')?.where).toMatch(/^Line 2 · Elio Grasso/);
    expect(result.matched).toEqual([]);
  });

  it('reports a line the client did not order, and one we left off, without forcing a match', () => {
    const swapped: OrderDoc = {
      ...salesOrder,
      printedText: '',
      lines: [
        salesOrder.lines[1]!,
        { name: 'Giuseppe Cortese Barbaresco 2019', vintage: '2019', sizeMl: 750, pack: 6, bottles: 6, perBottle: 154.67, lineTotal: 928 },
      ],
    };
    const codes = compareOrderDocuments({ lpo, salesOrder: swapped, invoices: [] }).findings.map((f) => f.code);

    expect(codes).toEqual(['LINE_MISSING', 'LINE_EXTRA']);
  });

  it('flags the same wine twice on one document', () => {
    const doubled: OrderDoc = { ...salesOrder, printedText: '', lines: [...salesOrder.lines, salesOrder.lines[0]!] };
    const codes = compareOrderDocuments({ lpo: null, salesOrder: doubled, invoices: [] }).findings.map((f) => f.code);

    expect(codes).toContain('DUPLICATE_LINE');
  });
});

describe('parseTermsDays', () => {
  it.each([
    ['SIXTY (60) DAYS CREDIT TERMS', 60, false],
    ['Net 30', 30, false],
    ['90 days', 90, false],
    ['Due end of the month', null, true],
    ['immediate, on collection', 0, false],
    ['Due on Receipt', 0, false],
  ])('reads %s', (text, days, endOfMonth) => {
    expect(parseTermsDays(text)).toMatchObject({ days, endOfMonth });
  });

  it('returns null for terms it cannot read', () => {
    expect(parseTermsDays('Consignment')).toBeNull();
  });
});
