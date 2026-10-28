import { describe, expect, it } from 'vitest';

import judgeLwinMatch from './judgeLwinMatch';

describe('judgeLwinMatch', () => {
  it('keeps our code when our name reads as its register name', () => {
    expect(
      judgeLwinMatch(
        'Antinori, Solaia, IGT 2016',
        'Antinori, Solaia',
        'Antinori, Tignanello',
      ),
    ).toBe('ours_right');
  });

  it('flags our code when our name reads as the suggestion instead', () => {
    expect(
      judgeLwinMatch(
        'Fourrier Griotte-Chambertin 2019',
        'Domaine Fourrier, Gevrey-Chambertin',
        'Domaine Fourrier, Griotte-Chambertin',
      ),
    ).toBe('likely_wrong');
  });

  it('flags our code when it is not in the register but the suggestion fits', () => {
    expect(judgeLwinMatch('Antinori Solaia', null, 'Antinori, Solaia')).toBe(
      'likely_wrong',
    );
  });

  it('asks for a person when neither name fits', () => {
    expect(
      judgeLwinMatch(
        'House Red Blend',
        'Antinori, Solaia',
        'Vincent Dancer, Bourgogne',
      ),
    ).toBe('check');
  });

  it('keeps our code on a tie', () => {
    expect(
      judgeLwinMatch('Antinori Solaia', 'Antinori, Solaia', 'Antinori, Solaia'),
    ).toBe('ours_right');
  });
});
