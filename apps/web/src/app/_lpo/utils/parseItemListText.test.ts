import { describe, expect, it } from 'vitest';

import parseAnyLpoText from './parseAnyLpoText';
import parseItemListText, { isItemList } from './parseItemListText';

/**
 * The Super Cellar purchase order, exactly as `pdf-parse` returns it. Quantity
 * and price run together ("54161.00") and a long name wraps onto a second
 * row with its vintage below — both are the point of this layout.
 */
const FIXTURE = [
  '',
  'S.NOITEM NAMEVINTAGEUOMQTYPRICE AEDTOTAL',
  '1',
  "Antinori, Guado al Tasso, Cont'Ugo, Bolgheri2013",
  'PCS',
  '54161.00',
  '8694.00',
  '4',
  'Château Grand-Puy Ducasse, 5ème Cru Classé, ',
  'Pauillac',
  '2022',
  'PCS',
  '6168.00',
  '1008.00',
].join('\n');

const FULL = [
  'S.NOITEM NAMEVINTAGEUOMQTYPRICE AEDTOTAL',
  '1',
  "Antinori, Guado al Tasso, Cont'Ugo, Bolgheri2013",
  'PCS',
  '54161.00',
  '8694.00',
  '2',
  'Château Grand-Puy Ducasse, 5ème Cru Classé, ',
  'Pauillac',
  '2022',
  'PCS',
  '6168.00',
  '1008.00',
  '3',
  'Compass Box Flaming Heart 2025, Blended Malt ',
  'Scotch Whisky',
  'NV',
  'PCS',
  '30236.00',
  '7080.00',
  '4',
  'VIVIR Café VS TequilaNV',
  'PCS',
  '6030.00',
  '1800.00',
  '5',
  'Livio Sassetti (Pertimali), Rosso di Montalcino2018',
  'PCS',
  '390.00',
  '270.00',
  '18,852.00AED  ',
  '18,852.00AED  ',
  'Delivery Timings: between 9.00AM to 5.00PM',
  'SUB TOTAL',
  'TOTAL',
  'SUPPLIER:   CRAFT AND CULTURE, UAE',
  'SUPER CELLAR GENERAL TRADING L.L.C ',
  'AI Jazeera / AI Hamra, RAK, UAE',
  'PURCHASE ORDER',
  'Order No           22148292',
  'Doc Date            08/10/2026',
  'Currency            AED',
].join('\n');

describe('parseItemListText', () => {
  it('recognises the layout and is routed to it', () => {
    expect(isItemList(FIXTURE)).toBe(true);
    expect(parseAnyLpoText(FULL).lines).toHaveLength(5);
  });

  it('separates quantity from price by the line total', () => {
    const { lines } = parseItemListText(FULL);

    expect(lines[0]).toMatchObject({
      wine: "Antinori, Guado al Tasso, Cont'Ugo, Bolgheri",
      vintage: '2013',
      bottles: 54,
      unitPriceAed: 161,
      lineTotalAed: 8694,
    });
    // "6030.00" for 1,800 is 60 × 30, never 6 × 030
    expect(lines[3]).toMatchObject({ bottles: 60, unitPriceAed: 30 });
    expect(lines[4]).toMatchObject({ bottles: 3, unitPriceAed: 90 });
  });

  it('joins a wrapped name and takes the vintage from its own row', () => {
    const { lines } = parseItemListText(FULL);

    expect(lines[1]).toMatchObject({
      wine: 'Château Grand-Puy Ducasse, 5ème Cru Classé, Pauillac',
      vintage: '2022',
    });
    expect(lines[2]).toMatchObject({
      wine: 'Compass Box Flaming Heart 2025, Blended Malt Scotch Whisky',
      vintage: 'NV',
      bottles: 30,
    });
  });

  it('reads the header, the buyer and the total', () => {
    const parsed = parseItemListText(FULL);

    expect(parsed.poNumber).toBe('22148292');
    expect(parsed.poDate).toBe('08/10/2026');
    // The buyer, not the SUPPLIER line, which names us
    expect(parsed.client).toBe('SUPER CELLAR GENERAL TRADING L.L.C');
    expect(parsed.declaredTotalAed).toBe(18852);
    expect(parsed.computedTotalAed).toBe(18852);
    expect(parsed.skipped).toEqual([]);
  });
});
