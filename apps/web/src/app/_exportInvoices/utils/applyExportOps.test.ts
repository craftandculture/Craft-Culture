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
