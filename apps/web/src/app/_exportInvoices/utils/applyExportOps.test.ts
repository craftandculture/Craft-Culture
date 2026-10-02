import { describe, expect, it } from 'vitest';

import { AED_PER_USD } from '../constants';
import type { ExportDocument } from '../schemas/exportDocumentSchema';
import exp0040 from './__fixtures__/exp0040Invoices.json';
import applyExportOps from './applyExportOps';
import buildExportLines from './buildExportLines';
import type { ExportInvoiceInput } from './buildExportLines';
import validateExportDocument from './validateExportDocument';

const party = { name: '', addressLines: [], trn: null };
const base = (): ExportDocument => {
  const invoices = exp0040 as ExportInvoiceInput[];
  const { sections, lines } = buildExportLines(invoices, {
    rate: AED_PER_USD,
    originByLwin: new Map(),
    boeByKey: new Map(),
  });
  return {
    header: {
      number: null, date: '2026-10-01', exporter: party, consignee: party, collection: party,
      terms: '', currency: 'AED', rate: AED_PER_USD, pallets: 2, grossWeightKg: null,
      grossWeightEstimated: true, casesOverride: null,
    },
    sources: invoices.map((i) => ({
      zohoInvoiceId: i.zohoInvoiceId, invoiceNumber: i.invoiceNumber, soNumber: i.soNumber,
      pcoNumber: i.pcoNumber, invoiceDate: i.invoiceDate, totalUsd: i.totalUsd,
    })),
    sections,
    lines: lines.map((l) => ({ ...l, boe: '20260503000037', origin: 'France' })),
    extraColumns: [],
    notes: [],
    declaration: '',
  };
};

describe('applyExportOps', () => {
  it('never mutates the document it is given', () => {
    const doc = base();
    const before = JSON.stringify(doc);
    applyExportOps(doc, [{ op: 'addNote', text: 'x' }]);
    expect(JSON.stringify(doc)).toBe(before);
  });

  it('keeps every bottle and every fil when a line is split', () => {
    const doc = base();
    const line = doc.lines.find((l) => l.qty === 2 && l.packBottles === 6);
    if (!line) throw new Error('no 2 × 6 line');
    const next = applyExportOps(doc, [
      { op: 'splitLine', lineId: line.id, parts: [{ packBottles: 6, qty: 1 }, { packBottles: 3, qty: 2 }] },
    ]);
    const parts = next.lines.filter((l) => l.id.startsWith(`${line.id}.`));
    expect(parts.reduce((s, p) => s + p.amount, 0)).toBeCloseTo(line.amount, 2);
    expect(parts.reduce((s, p) => s + p.qty * p.packBottles, 0)).toBe(12);
  });

  it('refuses a split that loses bottles', () => {
    const doc = base();
    const line = doc.lines.find((l) => l.qty === 2 && l.packBottles === 6);
    if (!line) throw new Error('no 2 × 6 line');
    expect(() =>
      applyExportOps(doc, [
        { op: 'splitLine', lineId: line.id, parts: [{ packBottles: 6, qty: 1 }, { packBottles: 3, qty: 1 }] },
      ]),
    ).toThrow(/change to the Zoho invoice/);
  });

  it('adds a column customs ask for and fills it', () => {
    const doc = base();
    const first = doc.lines[0];
    if (!first) throw new Error('no lines');
    const next = applyExportOps(doc, [
      { op: 'addColumn', key: 'abv', label: 'ABV' },
      { op: 'setColumnValues', key: 'abv', values: [{ lineId: first.id, value: '12.5%' }] },
    ]);
    expect(next.extraColumns).toEqual([{ key: 'abv', label: 'ABV' }]);
    expect(next.lines[0]?.extra.abv).toBe('12.5%');
  });
});

describe('validateExportDocument', () => {
  it('passes a clean build', () => {
    expect(validateExportDocument(base()).filter((c) => c.level === 'error')).toEqual([]);
  });

  it('blocks a line with no BOE', () => {
    const doc = base();
    const first = doc.lines[0];
    if (!first) throw new Error('no lines');
    const next = applyExportOps(doc, [{ op: 'setLineBoe', lineId: first.id, boe: null }]);
    expect(validateExportDocument(next).map((c) => c.code)).toContain('missing_boe');
  });

  it('turns a price override into a warning that names Zoho, not a silent change', () => {
    const doc = base();
    const first = doc.lines[0];
    if (!first) throw new Error('no lines');
    const next = applyExportOps(doc, [
      { op: 'overrideLine', lineId: first.id, unitPrice: 1, reason: 'test override' },
    ]);
    const codes = validateExportDocument(next).map((c) => `${c.level}:${c.code}`);
    expect(codes).toContain('warning:differs_from_zoho');
    expect(codes).toContain('warning:total_differs_by_override');
    expect(codes).not.toContain('error:total_mismatch');
  });

  it('blocks issuing when an invoice was revised in Zoho', () => {
    const codes = validateExportDocument(base(), { staleInvoices: ['INV-000381'] }).map((c) => c.code);
    expect(codes).toContain('invoice_revised');
  });
});

describe('mixed cases, item by item', () => {
  it('gives every wine in a mixed case its own origin and HS code', async () => {
    const { default: exp0041 } = await import('./__fixtures__/exp0041Invoices.json');
    const { lines } = buildExportLines(exp0041 as ExportInvoiceInput[], {
      rate: AED_PER_USD,
      originByLwin: new Map(),
      boeByKey: new Map(),
    });
    const mixed = lines.filter((l) => l.kind === 'mixedCase');
    expect(mixed.length).toBeGreaterThan(0);
    expect(mixed.every((l) => l.components.every((c) => c.hsCode === '22042100'))).toBe(true);
  });

  it('changes one wine without touching the others or the money', () => {
    const doc = base();
    const withCase: ExportDocument = {
      ...doc,
      lines: [
        {
          ...doc.lines[0]!,
          id: 'm1',
          kind: 'mixedCase',
          qty: 2,
          packBottles: 2,
          unitPrice: 30,
          amount: 60,
          components: [
            { description: 'Wine A', origin: 'France', hsCode: '22042100', unitPrice: 10, lwin18: null },
            { description: 'Wine B', origin: '', hsCode: '22042100', unitPrice: 20, lwin18: null },
          ],
        },
      ],
    };
    const next = applyExportOps(withCase, [{ op: 'setComponent', lineId: 'm1', index: 1, field: 'origin', value: 'Italy' }]);
    const line = next.lines[0]!;
    expect(line.components.map((c) => c.origin)).toEqual(['France', 'Italy']);
    expect(line.amount).toBe(60);
    expect(validateExportDocument(next).map((c) => c.code)).not.toContain('missing_origin');
  });
});
