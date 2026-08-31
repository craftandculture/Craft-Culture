import { describe, expect, it } from 'vitest';

import matchLpoLine from './matchLpoLine';
import type { CatalogueCandidate } from './matchLpoLine';

const row = (
  lwin18: string,
  wine: string,
  vintage: string,
  sizeMl: number,
  pack: number,
  bottles: number,
  source: CatalogueCandidate['source'] = 'stock',
): CatalogueCandidate => ({
  lwin18,
  wine,
  vintage,
  sizeMl,
  pack,
  bottles,
  source,
});

/** Hosanna as it is actually held: nothing in the 6-pack, twelve in the 3. */
const HOSANNA = [
  row('1011595-1999-06-00750', 'Chateau Hosanna, Pomerol', '1999', 750, 6, 0),
  row('1011595-1999-03-00750', 'Chateau Hosanna, Pomerol', '1999', 750, 3, 12),
  row('1011595-2003-06-00750', 'Chateau Hosanna, Pomerol', '2003', 750, 6, 12),
];

describe('matchLpoLine', () => {
  it('counts every pack of the wine, not the row it matched', () => {
    const result = matchLpoLine({
      wine: 'Chateau Hosanna, Pomerol',
      vintage: '1999',
      sizeMl: 750,
      bottles: 3,
      candidates: HOSANNA,
    });

    // Reading the 6-pack row alone reported this wine unfulfillable while
    // twelve bottles of it sat in the bay under a 3-pack code.
    expect(result.availableBottles).toBe(12);
    expect(result.rows).toHaveLength(2);
  });

  it('never lends one vintage the stock of another', () => {
    const result = matchLpoLine({
      wine: 'Chateau Hosanna, Pomerol',
      vintage: '1999',
      sizeMl: 750,
      bottles: 3,
      candidates: HOSANNA,
    });

    expect(result.lwin18).toContain('-1999-');
    expect(result.availableBottles).toBe(12);
    expect(result.rows.every((r) => r.vintage === '1999')).toBe(true);
  });

  it('keeps eight vintages of one wine apart', () => {
    const tignanello = ['1983', '1996', '1998', '2000', '2011', '2012'].map(
      (year, index) =>
        row(`1104637-${year}-03-00750`, 'Tignanello, Toscana', year, 750, 3, 3 + index),
    );

    const result = matchLpoLine({
      wine: 'Tignanello, Toscana',
      vintage: '2011',
      sizeMl: 750,
      bottles: 3,
      candidates: tignanello,
    });

    expect(result.lwin18).toBe('1104637-2011-03-00750');
  });

  it('treats bottle size as identity, not similarity', () => {
    const hautBailly = [
      row('1012208-2001-06-00750', 'Chateau Haut-Bailly, Pessac-Leognan', '2001', 750, 6, 24),
      row('1012208-2001-01-06000', 'Chateau Haut-Bailly, Pessac-Leognan', '2001', 6000, 1, 1),
    ];

    const result = matchLpoLine({
      wine: 'Château Haut-Bailly Cru Classé, Pessac-Léognan',
      vintage: '2001',
      sizeMl: 6000,
      bottles: 1,
      candidates: hautBailly,
    });

    // The 75cl row scores identically on name and holds far more stock.
    expect(result.lwin18).toBe('1012208-2001-01-06000');
    expect(result.availableBottles).toBe(1);
  });

  it('reads through accents and classification wording', () => {
    const result = matchLpoLine({
      wine: 'Chateau Grand-Puy-Lacoste 5ème Cru Classé',
      vintage: '2016',
      sizeMl: 1500,
      bottles: 3,
      candidates: [
        row('1012456-2016-03-01500', 'Château Grand Puy Lacoste, Pauillac', '2016', 1500, 3, 3),
      ],
    });

    expect(result.verdict).toBe('Matched');
    expect(result.lwin18).toBe('1012456-2016-03-01500');
  });

  it('refuses when a shorter name sits inside a different wine', () => {
    const result = matchLpoLine({
      wine: 'Opus One',
      vintage: '2016',
      sizeMl: 750,
      bottles: 3,
      candidates: [
        row('1102401-2016-03-00750', 'Opus One, Napa Valley', '2016', 750, 3, 6),
        row('1102402-2016-03-00750', 'Opus One Overture, Napa Valley', '2016', 750, 3, 6),
      ],
    });

    // Two real wines, one name inside the other: a person settles this.
    expect(result.lwin18).toBeNull();
    expect(result.verdict).toMatch(/Too close/);
    expect(result.shortlist).toHaveLength(2);
  });

  it('says when the order leaves nothing behind', () => {
    const result = matchLpoLine({
      wine: 'Petrus, Pomerol',
      vintage: '1995',
      sizeMl: 750,
      bottles: 1,
      candidates: [row('1013456-1995-01-00750', 'Petrus, Pomerol', '1995', 750, 1, 1)],
    });

    expect(result.takesLastBottles).toBe(true);
  });

  it('separates what is in transit from what is on the shelf', () => {
    const result = matchLpoLine({
      wine: 'Chateau Lagrange, Saint-Julien',
      vintage: '1988',
      sizeMl: 750,
      bottles: 3,
      candidates: [
        row('1011000-1988-03-00750', 'Chateau Lagrange, Saint-Julien', '1988', 750, 3, 6),
        row('1011000-1988-06-00750', 'Chateau Lagrange, Saint-Julien', '1988', 750, 6, 12, 'inbound'),
      ],
    });

    // Promising in-transit stock as picked is how an order is short on the day.
    expect(result.availableBottles).toBe(6);
    expect(result.inboundBottles).toBe(12);
  });

  it('says so plainly when the vintage is not on file', () => {
    const result = matchLpoLine({
      wine: 'Chateau Hosanna, Pomerol',
      vintage: '1961',
      sizeMl: 750,
      bottles: 3,
      candidates: HOSANNA,
    });

    expect(result.lwin18).toBeNull();
    expect(result.verdict).toMatch(/Nothing on file for 1961/);
  });
});
