import { describe, expect, it } from 'vitest';

import describeDelegateAction from './describeDelegateAction';

describe('describeDelegateAction', () => {
  it('names the actions a holder most needs to hear about', () => {
    expect(describeDelegateAction('cellar.member.submitRelease')).toBe(
      'requested a delivery',
    );
    expect(describeDelegateAction('consignment.member.createPurchase')).toBe(
      'reserved wine from The Cellar List',
    );
  });

  it('still says something for an action it does not know', () => {
    expect(describeDelegateAction('cellar.member.somethingNew')).toBe(
      'made a change in your private cellar',
    );
  });
});
