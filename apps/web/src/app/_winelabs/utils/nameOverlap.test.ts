import { describe, expect, it } from 'vitest';

import nameOverlap from './nameOverlap';

describe('nameOverlap', () => {
  it('finds every word of the reference in our longer name', () => {
    expect(
      nameOverlap('Antinori, Solaia, IGT 2016 Philipp', 'Antinori, Solaia'),
    ).toBe(1);
  });

  it('ignores accents, punctuation and words like Domaine', () => {
    expect(
      nameOverlap(
        'Dom. Comte Liger-Belair La Romanée',
        'Domaine du Comte Liger-Belair, La Romanee',
      ),
    ).toBe(1);
  });

  it('reads a shortened word as the same word', () => {
    expect(
      nameOverlap(
        'Fourrier Gevrey Chambertin BT',
        'Domaine Fourrier, Gevrey-Chambertin',
      ),
    ).toBe(1);
  });

  it('scores another cuvee of the same producer as a partial match', () => {
    expect(
      nameOverlap(
        'Fourrier Gevrey-Chambertin',
        'Domaine Fourrier, Griotte-Chambertin',
      ),
    ).toBeCloseTo(2 / 3);
  });

  it('scores an unrelated wine at zero', () => {
    expect(nameOverlap('Antinori Solaia', 'Vincent Dancer, Bourgogne')).toBe(0);
  });

  it('gives zero for a reference with no distinctive words', () => {
    expect(nameOverlap('Antinori Solaia', 'Domaine de la')).toBe(0);
  });
});
