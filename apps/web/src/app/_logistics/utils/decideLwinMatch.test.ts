import { describe, expect, it } from 'vitest';

import decideLwinMatch from './decideLwinMatch';

describe('decideLwinMatch', () => {
  it('takes Wine Labs when its answer reads as the line and names its producer', () => {
    expect(
      decideLwinMatch('Antinori Solaia 2016', { lwin7: '1095403', fit: 1, producer: 'Antinori' }, null),
    ).toEqual({ lwin7: '1095403', source: 'winelabs' });
  });

  it('leaves another producer for a person, even with a good fit', () => {
    expect(
      decideLwinMatch(
        'Rickety Bridge Noble Late Harvest, Franschhoek',
        { lwin7: '1597459', fit: 0.83, producer: 'Boekenhoutskloof' },
        '2034425',
      ),
    ).toBeNull();
  });

  it('does not let the register guess when Wine Labs named another wine', () => {
    expect(
      decideLwinMatch('Pauillac Pontet Canet 2016', { lwin7: '1014307', fit: 0.5, producer: 'Pontet-Canet' }, '1011511'),
    ).toBeNull();
  });

  it('takes the wine both name, even when Wine Labs alone was unsure', () => {
    expect(
      decideLwinMatch('Pauillac Pontet Canet 2016', { lwin7: '1014307', fit: 0.5, producer: 'Pontet-Canet' }, '1014307'),
    ).toEqual({ lwin7: '1014307', source: 'winelabs' });
  });

  it('falls back to the register when Wine Labs found nothing', () => {
    expect(decideLwinMatch('Some Wine', null, '1000001')).toEqual({ lwin7: '1000001', source: 'register' });
    expect(decideLwinMatch('Some Wine', null, null)).toBeNull();
  });
});
