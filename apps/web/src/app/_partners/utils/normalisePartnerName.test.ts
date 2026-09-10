import { describe, expect, it } from 'vitest';

import normalisePartnerName from './normalisePartnerName';

describe('normalisePartnerName', () => {
  it('treats spelling, case and punctuation of one business as the same key', () => {
    const key = normalisePartnerName('Craft & Culture');

    expect(normalisePartnerName('CRAFT AND CULTURE')).toBe(key);
    expect(normalisePartnerName('Craft and Culture FZE')).toBe(key);
    expect(normalisePartnerName('  Craft   &   Culture  ')).toBe(key);
  });

  it('strips registered suffixes, including several stacked up', () => {
    expect(normalisePartnerName('Wilkinson Vintners Ltd')).toBe(
      'wilkinson vintners',
    );
    expect(normalisePartnerName('Seckford Trading Group Ltd')).toBe('seckford');
  });

  it('keeps genuinely different businesses apart', () => {
    expect(normalisePartnerName('Cru Wine')).not.toBe(
      normalisePartnerName('Cult Wines'),
    );
  });

  /*
    The merge tool renames a retired record to "X (merged into Y)". While that
    annotation counted towards the key, a merged record stopped grouping with
    its survivor: the duplicate finder could no longer see the pair, so an
    order later raised against the retired id could never be swept up — the
    merge was a one-way door. These pin that shut.
  */
  it('groups a merged record with the business it was merged into', () => {
    expect(
      normalisePartnerName('Craft & Culture (merged into Craft & Culture)'),
    ).toBe(normalisePartnerName('Craft & Culture'));
  });

  it('groups a record that has been merged more than once', () => {
    expect(
      normalisePartnerName(
        'Craft & Culture (merged into Craft & Culture) (merged into Craft & Culture)',
      ),
    ).toBe(normalisePartnerName('Craft & Culture'));
  });

  it('leaves a name that merely mentions merging alone', () => {
    expect(normalisePartnerName('Merged Cellars')).toBe('merged cellars');
  });

  it('returns an empty key for a name with nothing to compare', () => {
    expect(normalisePartnerName('   ')).toBe('');
    expect(normalisePartnerName('!!!')).toBe('');
  });
});
