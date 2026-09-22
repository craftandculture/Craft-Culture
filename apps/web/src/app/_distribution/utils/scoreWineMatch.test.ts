import { describe, expect, it } from 'vitest';

import scoreWineMatch from './scoreWineMatch';

/** Pick the best of several candidates, as the suggestion list does */
const best = (ours: string, candidates: string[]) =>
  candidates
    .map((theirs) => ({ theirs, ...scoreWineMatch(ours, theirs) }))
    .sort((a, b) => b.score - a.score)[0]!;

describe('scoreWineMatch', () => {
  /*
    The contract is ranking, not deciding. These are the pairs an earlier
    attempt matched confidently and wrongly, and the test is that the RIGHT
    wine comes out on top — not that the wrong one scores below some line.
  */
  it.each([
    [
      'Chateau Margaux Premier Cru Classe, Margaux 2017',
      'Chateau Margaux 2017',
      ['Chateau Rauzan-Segla Margaux 2017', 'Chateau Margaux 2017'],
    ],
    [
      'Joseph Phelps, Insignia, Napa Valley 2016',
      'Joseph Phelps Insignia 2016',
      ['Opus One Napa Valley 2016', 'Joseph Phelps Insignia 2016'],
    ],
    [
      'Chateau Talbot 4eme Cru Classe, Saint Julien 2018',
      'Chateau Talbot 2018',
      ['Château Mouton Rothschild Pauillac 2018', 'Chateau Talbot 2018'],
    ],
  ])('ranks the right wine top for %s', (ours, expected, candidates) => {
    expect(best(ours, candidates).theirs).toBe(expected);
  });

  it('matches the same wine named at different lengths', () => {
    const result = scoreWineMatch(
      'La Mondotte 2008',
      'La Mondotte Saint-Emilion Grand Cru 2008',
    );

    expect(result.score).toBeGreaterThan(0.5);
    expect(result.rejected).toBeNull();
  });

  it('refuses a different vintage outright', () => {
    const result = scoreWineMatch('Tignanello 2016', 'Tignanello 2013');

    expect(result.score).toBe(0);
    expect(result.rejected).toMatch(/vintage/);
  });

  /*
    A shared vintage is not a shared wine. Left counting, it made "Tignanello
    2022" the one suggestion offered for every 2022 on the page, because two
    words of which one matches scores high enough to clear any useful
    threshold.
  */
  it('does not let a shared vintage carry a match', () => {
    expect(
      scoreWineMatch(
        'Domaine Lafouge Meursault Clos de Rougeot 2022',
        'Tignanello 2022',
      ).score,
    ).toBe(0);
  });

  it('does not let a shared bottle size carry a match', () => {
    expect(
      scoreWineMatch('Chateau Palmer 75cl', 'Sassicaia 75cl').score,
    ).toBe(0);
  });

  it('still ranks the right wine top among wines of one vintage', () => {
    expect(
      best('Domaine de Montille Bourgogne Blanc 2022', [
        'Tignanello 2022',
        'Montille Bourgogne Blanc 2022',
      ]).theirs,
    ).toBe('Montille Bourgogne Blanc 2022');
  });

  /*
    The shape the automatic sweep relies on: the distributor writes the same
    words in a different order, and that is not a judgement call.
  */
  it('scores a reordered name high enough to link unaided', () => {
    expect(
      scoreWineMatch(
        'Guidalberto, Tenuta San Guido, Toscana 2020 (1x75cl)',
        'Tenuta San Guido Guidalberto Toscana 2020',
      ).score,
    ).toBeGreaterThan(0.55);
  });

  it('refuses a different bottle size outright', () => {
    expect(
      scoreWineMatch('Chateau Latour 1993 75cl', 'Chateau Latour 1993 150cl')
        .rejected,
    ).toMatch(/size/);
  });

  it('scores a word-order difference as the same wine', () => {
    const result = scoreWineMatch(
      'Brunello di Montalcino Tenuta Nuova, Casanova di Neri 2008',
      'Casanova di Neri Brunello di Montalcino Tenuta Nuova 2008',
    );

    expect(result.score).toBeGreaterThan(0.9);
  });
});
