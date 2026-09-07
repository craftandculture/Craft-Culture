import { describe, expect, it } from 'vitest';

import parseProformaText, { isProforma } from './parseProformaText';

/**
 * A Craft & Culture proforma, exactly as `pdf-parse` returns it — including the
 * amounts broken across rows, which is not a transcription slip.
 */
const FIXTURE = [
  'Craft and Culture FZE',
  'Fujairah Free Zone',
  'Proforma Invoice',
  'Ref# PROFORMA-SUNIL-001',
  'Invoice Date : September 2026',
  'Brought in by : Sunil',
  'Bill To :',
  'The Bottle Store General Trading LLC –',
  'SPC',
  'Al Saman Towers,',
  'Abu Dhabi',
  'Subject :TBS Private Client',
  '#Item',
  '1',
  'Hospice de Beaune 2023 - Savigny les Beaune 1er',
  'Cru Cuvée Arthur Girard',
  '6×750ml22042100France6100.87',
  '605.2',
  '0',
  '2',
  'Hospice de Beaune 2023 - Savigny les Beaune 1er',
  'Cru Cuvée Arthur Girard',
  '3×1500ml22042100France3204.72',
  '614.1',
  '7',
  '3',
  'Hospice de Beaune 2023 - Pernand Vergelesses 1er',
  'Cru Les Vergelesses Cuvée Rameau Lamarosse',
  '6×750ml22042100France1265.01',
  '780.1',
  '7',
  '4',
  'Hospice de Beaune 2023 - Pernand Vergelesses 1er',
  'Cru Les Vergelesses Cuvée Rameau Lamarosse',
  '3×1500ml22042100France6133.02',
  '798.0',
  '9',
  '5',
  'Hospice de Beaune 2023 - Beaune 1er Cru Cuvée',
  'M. Drouhin',
  '6×750ml22042100France24100.39',
  '2,409.',
  '34',
  'TOTAL CASES 10',
  'Sub Total (Tax Inclusive)5,206.98',
  'Total$5,206.98',
  'Balance Due$5,206.98',
  'Terms & Conditions : ***** US Dollar account *****',
].join('\n');

/** USD per AED, as the parser converts at. */
const USD_PER_AED = 0.2723;
const aed = (usd: number) => Math.round((usd / USD_PER_AED) * 100) / 100;

describe('parseProformaText', () => {
  it('recognises the layout', () => {
    expect(isProforma(FIXTURE)).toBe(true);
    expect(isProforma('ORDER FORM\nPrice (per Case)')).toBe(false);
  });

  it('reads every line', () => {
    expect(parseProformaText(FIXTURE).lines).toHaveLength(5);
    expect(parseProformaText(FIXTURE).skipped).toHaveLength(0);
  });

  /*
    The one that made this worth a parser of its own. "1265.01" is twelve at
    65.01, and also one at 265.01 — only the amount says which, and the rate is
    printed rounded so it does not multiply back exactly.
  */
  it('separates a fused quantity and rate by the amount they come to', () => {
    const [first, , third] = parseProformaText(FIXTURE).lines;

    expect(first?.bottles).toBe(6);
    expect(third?.bottles).toBe(12);
    expect(third?.unitPriceAed).toBeCloseTo(aed(65.01), 2);
  });

  it('counts bottles, and the cases they make up', () => {
    const cases = parseProformaText(FIXTURE).lines.reduce(
      (sum, line) => sum + (line.cases ?? 0),
      0,
    );

    // The document states TOTAL CASES 10
    expect(cases).toBe(10);
    expect(parseProformaText(FIXTURE).totalBottles).toBe(51);
  });

  /*
    Everything downstream is named `...Aed` and converted again on the way to
    Zoho. A dollar figure left as-is would be billed at a quarter of its worth.
  */
  it('converts the dollars it is written in to dirhams at the peg', () => {
    const result = parseProformaText(FIXTURE);

    expect(result.declaredTotalAed).toBeCloseTo(aed(5206.98), 1);
    expect(result.lines[0]?.lineTotalAed).toBeCloseTo(aed(605.2), 2);
  });

  it('rejoins an amount broken across rows', () => {
    // "2,409." then "34"
    expect(parseProformaText(FIXTURE).lines[4]?.lineTotalAed).toBeCloseTo(
      aed(2409.34),
      2,
    );
  });

  it('takes the vintage out of the name and states it on its own', () => {
    const [first] = parseProformaText(FIXTURE).lines;

    expect(first?.vintage).toBe('2023');
    expect(first?.wine).not.toMatch(/2023/);
    expect(first?.wine).toContain('Savigny les Beaune');
  });

  it('reads the header and who it is billed to', () => {
    const result = parseProformaText(FIXTURE);

    expect(result.poNumber).toBe('PROFORMA-SUNIL-001');
    // The dash is part of the name, not a line break the extractor left behind
    expect(result.client).toBe('The Bottle Store General Trading LLC – SPC');
  });

  it('reports a run it cannot split rather than guessing a quantity', () => {
    const broken = FIXTURE.replace('France6100.87', 'France1111.11');
    const [first] = parseProformaText(broken).lines;

    expect(first?.bottles).toBe(0);
    expect(first?.problem).toMatch(/does not divide/);
  });
});
