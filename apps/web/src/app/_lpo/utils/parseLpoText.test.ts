import { describe, expect, it } from 'vitest';

import parseLpoText from './parseLpoText';

/**
 * The shape a client purchase order arrives in, reproduced from the reference
 * document named in `_lpo/LPO.md`. Figures are invented; the awkwardness is
 * not — every case below appears in a real order.
 */
const FIXTURE = [
  'C D General Trading L.L.C. - S.P.C',
  'DATE: 24 August 2026',
  'Mamoura, Khalifa Industrial 9, Abu Dhabi, United Arab Emirates',
  'PO NO. LPOCON24082026',
  'VintageVolume',
  'QTY (Bottles) - OfferedUnit Price (Aed) Bottles)Total',
  'Bordeaux',
  'Alter Ego, Margaux',
  '201775cl6.00',
  '405.00                                         2,430.00',
  'Bordeaux',
  'Chateau Grand-Puy-Lacoste 5ème Cru Classé',
  '20161.5L Magnum3.00',
  '957.00                                         2,871.00',
  'Bordeaux',
  'Chateau La Grave, Pomerol',
  '20173L Double Magnum1.00',
  '1,200.00                                      1,200.00',
  'Bordeaux',
  'Château Haut-Bailly Cru Classé, Pessac-Léognan',
  '20016L Imperial1.00',
  '2,000.00                                      2,000.00',
  'Champagne',
  'Krug, Grande Cuvée',
  'NV75cl6.00',
  '500.00                                         3,000.00',
  'Grand Total11,501.00',
  'Credit Terms - Consignment',
].join('\n');

describe('parseLpoText', () => {
  it('reads every line of the order', () => {
    const result = parseLpoText(FIXTURE);

    expect(result.lines).toHaveLength(5);
    expect(result.totalBottles).toBe(17);
    expect(result.skipped).toEqual([]);
  });

  it('splits vintage, format and quantity out of one run of characters', () => {
    const [alterEgo] = parseLpoText(FIXTURE).lines;

    // "201775cl6.00" — the digits of the year run straight into the format.
    expect(alterEgo?.vintage).toBe('2017');
    expect(alterEgo?.sizeMl).toBe(750);
    expect(alterEgo?.bottles).toBe(6);
    expect(alterEgo?.unitPriceAed).toBe(405);
    expect(alterEgo?.lineTotalAed).toBe(2430);
  });

  it('reads each large format to its true size', () => {
    const sizes = parseLpoText(FIXTURE).lines.map((line) => line.sizeMl);

    // A magnum read as 1.5ml, or an imperial as a 75cl, orders the wrong wine.
    expect(sizes).toEqual([750, 1500, 3000, 6000, 750]);
  });

  it('keeps NV as a vintage rather than a missing one', () => {
    const krug = parseLpoText(FIXTURE).lines.at(-1);

    expect(krug?.vintage).toBe('NV');
    expect(krug?.bottles).toBe(6);
  });

  it('carries the client wording and region through untouched', () => {
    const [alterEgo] = parseLpoText(FIXTURE).lines;

    // The client's own name for the wine is what the matcher has to work with.
    expect(alterEgo?.wine).toBe('Alter Ego, Margaux');
    expect(alterEgo?.region).toBe('Bordeaux');
  });

  it('reads the header and the terms the order is placed on', () => {
    const result = parseLpoText(FIXTURE);

    expect(result.poNumber).toBe('LPOCON24082026');
    expect(result.poDate).toBe('24 August 2026');
    expect(result.client).toBe('C D General Trading L.L.C. - S.P.C');
    expect(result.creditTerms).toBe('Consignment');
  });

  it('checks its own reading against the stated grand total', () => {
    const result = parseLpoText(FIXTURE);

    expect(result.computedTotalAed).toBe(11501);
    expect(result.declaredTotalAed).toBe(11501);
  });

  it('reports a line that does not multiply, rather than correcting it', () => {
    const wrong = FIXTURE.replace(
      '405.00                                         2,430.00',
      '405.00                                         2,530.00',
    );

    const [alterEgo] = parseLpoText(wrong).lines;

    expect(alterEgo?.problem).toMatch(/2430\.00.*2530\.00/);
    // The document's figure is kept; the disagreement is the point.
    expect(alterEgo?.lineTotalAed).toBe(2530);
  });

  it('lists a block it cannot read instead of dropping it', () => {
    const broken = FIXTURE.replace('201775cl6.00', '2017 unreadable 6.00');

    const result = parseLpoText(broken);

    // Four lines and a named casualty beats five lines with one invented.
    expect(result.lines).toHaveLength(4);
    expect(result.skipped).toEqual(['2017 unreadable 6.00']);
  });

  it('ignores a stray figure that is not an order line', () => {
    const noise = `${FIXTURE}\n1234567890.00`;

    expect(parseLpoText(noise).lines).toHaveLength(5);
  });
});
