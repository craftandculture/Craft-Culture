import { describe, expect, it } from 'vitest';

import judgeLwinMatch from './judgeLwinMatch';

/** Real disagreements from the October 2026 audit of our stock */
describe('judgeLwinMatch', () => {
  it('keeps our code when our name reads as its register name', () => {
    expect(
      judgeLwinMatch(
        'Antinori, Tignanello, IGT 2021',
        'Marchesi Antinori, Tignanello, IGT',
        'Tignanello, Toscana',
      ),
    ).toBe('ours_right');
  });

  it('sees one wine listed twice in the register', () => {
    expect(
      judgeLwinMatch(
        'Antinori, Bolgheri, Guado Al Tasso 2011',
        'Marchesi Antinori, Bolgheri, Guado Al Tasso',
        'Guado Al Tasso, Bolgheri',
      ),
    ).toBe('same_wine');
    expect(
      judgeLwinMatch(
        'Fattoria Le Pupille, Maremma Toscana, Saffredi 2020',
        'Fattoria Pupille, Maremma Toscana, Saffredi Elisabetta Geppetti',
        'Fattoria Le Pupille, Saffredi, Toscana IGT',
      ),
    ).toBe('same_wine');
  });

  it('flags a white wine held under the red wine code', () => {
    expect(
      judgeLwinMatch(
        "2023 Bourgogne blanc 'En la Place' Maison Camille Thiriet 75 cl Blanc 13% 2023",
        'C. Thiriet, Bourgogne, En La Place Pinot Noir',
        'C. Thiriet, Bourgogne, En la Place Chardonnay',
      ),
    ).toBe('likely_wrong');
  });

  it('flags a premier cru held under the village code', () => {
    expect(
      judgeLwinMatch(
        'Domaine Denis Mortet Premier Cru Gevrey-Chambertin 2020 0.75L 13%abv 2020',
        'Domaine Denis Mortet, Gevrey-Chambertin, Villages',
        'Domaine Denis Mortet, Gevrey-Chambertin Premier Cru',
      ),
    ).toBe('likely_wrong');
  });

  it('does not move a premier cru onto a village code', () => {
    expect(
      judgeLwinMatch(
        'Domaine Fourrier Premier Cru Gevrey-Chambertin Vieille Vigne 2021',
        'Domaine Fourrier, Gevrey-Chambertin Premier Cru, Champeaux Vieille Vigne',
        'Domaine Fourrier, Gevrey-Chambertin, Vieille Vigne',
      ),
    ).toBe('ours_right');
  });

  it('does not suggest another bin number', () => {
    expect(
      judgeLwinMatch(
        'Penfolds, Bin 18A Reserve Chardonnay, Adelaide Hills (1x) 2018',
        null,
        'Penfolds, Bin 23A Reserve Chardonnay, Adelaide Hills',
      ),
    ).toBe('check');
  });

  it('asks for a person when neither name fits', () => {
    expect(
      judgeLwinMatch(
        'Domaine de Marzilly (Ullens) Casse-Tete 0.75L 12.5%abv NV',
        'Domaine de Marzilly (Ullens), M Extra Brut, Champagne',
        'Domaine de Marzilly (Ullens), Lot 04 Brut, Champagne',
      ),
    ).toBe('check');
  });
});
