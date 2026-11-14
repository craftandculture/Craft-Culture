import { describe, expect, it } from 'vitest';

import buildUkImportDocument from './buildUkImportDocument';
import type { UkImportReadLine } from './buildUkImportDocument';
import deriveDocumentTotals from './deriveDocumentTotals';
import validateExportDocument from './validateExportDocument';

const line = (over: Partial<UkImportReadLine>): UkImportReadLine => ({
  documentReference: 'BI565619',
  description: 'Chateau Gazin Grand Vin de Pomerol 1989',
  country: 'France',
  region: 'Bordeaux',
  packBottles: 6,
  bottleSizeCl: 75,
  bottles: 6,
  pricePerBottle: null,
  lineTotal: null,
  currency: 'GBP',
  dutyStatus: 'DP',
  abv: '13%',
  ...over,
});

const options = {
  bond: 'lcbTilbury' as const,
  gbpUsdRate: 1.27,
  transport: 'Air Freight' as const,
  portOfLoading: 'London Gateway, United Kingdom',
  portOfDischarge: 'RAK Airport (RKT)',
  date: '2026-08-27',
};

const docs = [{ reference: 'BI565619', supplier: 'Dreweatts', date: '2026-05-27', currency: 'GBP' as const, statedTotal: null }];

describe('buildUkImportDocument', () => {
  // Lines from the C&C (LCB) invoice of 27 Aug 2026, as customs cleared it
  it('ships on the UK EORI to C&C FZE, priced per lot in USD at the GBP rate', () => {
    const doc = buildUkImportDocument(docs, [
      line({ pricePerBottle: 90.94 }), // £90.94 × 1.27 = $115.49 a bottle
      line({ description: 'Luce della Vite Brunello di Montalcino 2020', country: 'Italy', region: 'Tuscany', packBottles: 3, bottles: 60, pricePerBottle: 52.5, dutyStatus: 'IB', abv: '15%' }),
    ], options);

    expect(doc.header.kind).toBe('ukImport');
    expect(doc.header.exporter).toMatchObject({ name: 'Craft and Culture', trn: 'GB048089787000', idLabel: 'UK EORI' });
    expect(doc.header.consignee.name).toBe('Craft and Culture FZE');
    expect(doc.header.terms).toBe('Ex Works (LCB Tilbury)');
    expect(doc.header.stamp).toBe('ukEori');
    expect(doc.lines[0]).toMatchObject({ qty: 1, packBottles: 6, unitPrice: 692.96, amount: 692.96, extra: { duty: 'DP', abv: '13%' } });
    expect(doc.lines[1]).toMatchObject({ origin: 'Italy', qty: 20, packBottles: 3, unitPrice: 200.03, amount: 4000.6 });
    expect(doc.sections.map((s) => s.note)).toEqual(['FRANCE — BORDEAUX', 'ITALY — TUSCANY']);
    expect(doc.header.exportDetails?.find((d) => d.label === 'Duty Status')?.value).toBe(
      'Mixed — 1 cases duty paid (DP), 20 cases in bond (IB). Status shown per line.',
    );
    expect(doc.notes).toEqual(['Values converted from GBP at GBP/USD 1.27.']);
    expect(deriveDocumentTotals(doc).bottles).toBe(66);
  });

  it('keeps an odd lot as one line of its own pack', () => {
    const doc = buildUkImportDocument(docs, [line({ packBottles: 5, bottles: 5, lineTotal: 268.66 })], options);
    expect(doc.lines[0]).toMatchObject({ packBottles: 5, qty: 1, amount: 341.2 });
  });

  // The BBR stock list of 14 Nov: bottles and case size per line, price per bottle in bond
  it('derives cases from the bottle count, so a case of 6 is one case, not six', () => {
    const doc = buildUkImportDocument(docs, [
      line({ description: 'Gevrey-Chambertin, Les Platières, Domaine Guyon 2019', packBottles: 6, bottles: 6, pricePerBottle: 41.66 }),
      line({ description: 'Volnay, Ronceret, 1er Cru, Domaine Nicolas Rossignol 2010', packBottles: 1, bottles: 2, pricePerBottle: 38 }),
      line({ description: 'Odd count against a case of 6', packBottles: 6, bottles: 4, pricePerBottle: 10 }),
    ], options);

    expect(doc.lines[0]).toMatchObject({ packBottles: 6, qty: 1, unitPrice: 317.45, amount: 317.45 });
    expect(doc.lines[1]).toMatchObject({ packBottles: 1, qty: 2, unitPrice: 48.26, amount: 96.52 });
    expect(doc.lines[2]).toMatchObject({ packBottles: 1, qty: 4, unitPrice: 12.7, amount: 50.8 });
    expect(deriveDocumentTotals(doc).bottles).toBe(12);
  });

  it('issues without BOEs or Zoho invoices, and warns only on what needs a look', () => {
    const doc = buildUkImportDocument(
      [{ ...docs[0]!, statedTotal: 100 }],
      [line({ pricePerBottle: 10, dutyStatus: null })],
      options,
    );
    const codes = validateExportDocument(doc).map((c) => c.code);

    expect(codes).not.toContain('missing_boe');
    expect(codes).not.toContain('total_mismatch');
    expect(codes).toContain('missing_duty_status');
    // 6 × £10 × 1.27 = $76.20 against a stated £100 = $127
    expect(codes).toContain('total_differs_from_documents');
    expect(validateExportDocument(doc).some((c) => c.level === 'error')).toBe(false);
  });
});
