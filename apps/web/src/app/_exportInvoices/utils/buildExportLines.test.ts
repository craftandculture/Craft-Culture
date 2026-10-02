import { describe, expect, it } from 'vitest';

import { AED_PER_USD } from '../constants';
import type { ExportDocument } from '../schemas/exportDocumentSchema';
import exp0040 from './__fixtures__/exp0040Invoices.json';
import exp0041 from './__fixtures__/exp0041Invoices.json';
import applyExportOps from './applyExportOps';
import buildExportLines from './buildExportLines';
import type { ExportInvoiceInput } from './buildExportLines';
import deriveDocumentTotals from './deriveDocumentTotals';

const toDoc = (invoices: ExportInvoiceInput[]): ExportDocument => {
  const { sections, lines } = buildExportLines(invoices, {
    rate: AED_PER_USD,
    originByLwin: new Map(),
    boeByKey: new Map(),
  });
  const party = { name: '', addressLines: [], trn: null };
  return {
    header: {
      number: null,
      date: '2026-10-01',
      exporter: party,
      consignee: party,
      collection: party,
      terms: '',
      currency: 'AED',
      rate: AED_PER_USD,
      pallets: 2,
      grossWeightKg: null,
      grossWeightEstimated: true,
      casesOverride: null,
    },
    sources: invoices.map((i) => ({
      zohoInvoiceId: i.zohoInvoiceId,
      invoiceNumber: i.invoiceNumber,
      soNumber: i.soNumber,
      pcoNumber: i.pcoNumber,
      invoiceDate: i.invoiceDate,
      totalUsd: i.totalUsd,
    })),
    sections,
    lines,
    extraColumns: [],
    notes: [],
    declaration: '',
  };
};

describe('buildExportLines, replaying the hand-built export invoices', () => {
  it('rebuilds EXP-2026-0040 (The Bottle Store) to the figure that was issued', () => {
    const doc = toDoc(exp0040 as ExportInvoiceInput[]);
    const totals = deriveDocumentTotals(doc);
    expect(doc.lines).toHaveLength(67);
    expect(totals.cases).toBe(80);
    expect(totals.bottles).toBe(376);
    // The issued document said 231,391.33: it rounded 2,210.00 × 3.6725 =
    // 8,116.225 down. Half-up gives .23, so the rebuild is one fil higher.
    expect(totals.total).toBe(231391.34);

    const bySection = doc.sections.map((s) =>
      Math.round(doc.lines.filter((l) => l.sectionId === s.id).reduce((a, l) => a + l.amount, 0) * 100) / 100,
    );
    expect(bySection).toEqual([51825.42, 139611.57, 21804.33, 18150.02]);
  });

  it('packs City Drinks PCO orders into mixed cases of three (EXP-2026-0041)', () => {
    const doc = toDoc(exp0041 as ExportInvoiceInput[]);
    const totals = deriveDocumentTotals(doc);
    expect(doc.lines).toHaveLength(36);
    expect(totals.cases).toBe(83);

    // A six-bottle order is two cartons; five identical orders share each line
    const mixed = doc.lines.filter((l) => l.kind === 'mixedCase');
    expect(mixed.every((l) => l.packBottles === 3)).toBe(true);
    expect(doc.lines.filter((l) => l.kind === 'mixedCase' && l.qty === 5 && l.description.includes('Livio Sassetti'))).toHaveLength(1);

    // The two-bottle Lynch-Bages order is one carton of one wine
    const lynch = doc.lines.find((l) => l.description.startsWith('Lynch Bages 2000'));
    expect(lynch).toMatchObject({ kind: 'cased', packBottles: 2, qty: 1 });
  });

  it('matches the issued EXP-2026-0041 once the operator fixes the bourbon and Giscours packs', () => {
    const doc = toDoc(exp0041 as ExportInvoiceInput[]);
    const bourbon = doc.lines.find((l) => /bourbon/i.test(l.description));
    const giscours = doc.lines.find((l) => /Giscours.*2017/.test(l.description));
    if (!bourbon || !giscours) throw new Error('fixture lines missing');

    const edited = applyExportOps(doc, [
      { op: 'setLine', lineId: bourbon.id, field: 'packBottles', value: 6 },
      { op: 'setLine', lineId: giscours.id, field: 'packBottles', value: 6 },
      {
        op: 'overrideLine',
        lineId: giscours.id,
        unitPrice: Math.round(445.02 * 3.6725 * 100) / 100,
        reason: 'Priced as a 12-pack; ships as a 6-pack',
      },
    ]);
    const totals = deriveDocumentTotals(edited);
    expect(totals.cases).toBe(83);
    expect(totals.bottles).toBe(391);
    expect(totals.total).toBe(111921.09);
  });
});
