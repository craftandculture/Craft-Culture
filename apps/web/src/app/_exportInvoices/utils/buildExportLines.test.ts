import { describe, expect, it } from 'vitest';

import { AED_PER_USD } from '../constants';
import type { ExportDocument } from '../schemas/exportDocumentSchema';
import exp0040 from './__fixtures__/exp0040Invoices.json';
import exp0041 from './__fixtures__/exp0041Invoices.json';
import applyExportOps from './applyExportOps';
import buildExportLines from './buildExportLines';
import type { ExportInvoiceInput } from './buildExportLines';
import deriveDocumentTotals from './deriveDocumentTotals';
import validateExportDocument from './validateExportDocument';

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
  it('lists a carton of one wine as a case of it, and identical cartons once (EXP-2026-0046)', () => {
    const line = (n: number, name: string, quantity: number, rate: number) => ({
      lineItemId: `L${n}`,
      name: `${name} (1x75cl)`,
      description: '1x75cl',
      lwin18: null,
      quantity,
      rate,
      netUsd: quantity * rate,
      zohoHsCode: null,
    });
    const doc = toDoc([
      {
        zohoInvoiceId: 'INV-000404',
        invoiceNumber: 'INV-000404',
        soNumber: 'SO-00200',
        pcoNumber: 'PCO-2026-00081',
        invoiceDate: '2026-10-08',
        totalUsd: 0,
        lines: [
          line(1, 'Domaine Fournier Gevrey-Chambertin 2023', 12, 104.83),
          line(2, 'Vincent Dancer Bourgogne Blanc 2023', 6, 65.33),
          line(3, 'Cantina del Barone Fiano d Avellino 2022', 2, 49),
        ],
      },
    ]);
    const totals = deriveDocumentTotals(doc);

    // Twelve Fournier: one line of four cases of three, not four "mixed cases"
    expect(doc.lines.filter((l) => l.description.startsWith('Domaine Fournier'))).toEqual([
      expect.objectContaining({ kind: 'cased', packBottles: 3, qty: 4 }),
    ]);
    expect(doc.lines.find((l) => l.description.startsWith('Vincent Dancer'))).toMatchObject({
      kind: 'cased',
      packBottles: 3,
      qty: 2,
    });
    // Two Barone and nothing else left: a carton of two
    expect(doc.lines.find((l) => l.description.startsWith('Cantina del Barone'))).toMatchObject({
      kind: 'cased',
      packBottles: 2,
      qty: 1,
    });
    expect(doc.lines).toHaveLength(3);
    expect(totals.cases).toBe(7);
    expect(totals.bottles).toBe(20);
    // Priced per case as three rounded bottles, the same as a mixed carton
    const perBottle = Math.round(104.83 * AED_PER_USD * 100) / 100;
    expect(doc.lines[0]).toMatchObject({
      unitPrice: Math.round(perBottle * 3 * 100) / 100,
      amount: Math.round(perBottle * 3 * 4 * 100) / 100,
    });
  });
  it('refuses a declaration that leaves out an origin on the lines (EXP-2026-0046)', () => {
    const doc = toDoc(exp0041 as ExportInvoiceInput[]);
    const [first] = doc.lines;
    if (!first) throw new Error('fixture lines missing');
    const edited = applyExportOps(doc, [
      { op: 'setLine', lineId: first.id, field: 'origin', value: 'United Kingdom' },
      { op: 'setDeclaration', text: 'The goods are of France, Italy origin.' },
    ]);
    const check = validateExportDocument(edited).find((c) => c.code === 'undeclared_origin');
    expect(check).toMatchObject({ level: 'error', lineIds: [first.id] });
    expect(check?.message).toContain('United Kingdom');

    const fixed = applyExportOps(edited, [
      { op: 'setDeclaration', text: 'The goods are of France, Italy, United Kingdom origin.' },
    ]);
    expect(validateExportDocument(fixed).some((c) => c.code === 'undeclared_origin')).toBe(false);
  });
});
