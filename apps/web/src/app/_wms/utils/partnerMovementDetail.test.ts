import { describe, expect, it } from 'vitest';

import partnerMovementDetail from './partnerMovementDetail';

describe('partnerMovementDetail', () => {
  it('shows a take-out in the owner’s words, never the reason or recipient', () => {
    expect(partnerMovementDetail('adjust', 'stock_out:marketing')).toBe('Sold');
    expect(partnerMovementDetail('adjust', 'stock_out:breakage')).toBe('Damaged in our care · reimbursed');
    expect(partnerMovementDetail('adjust', 'stock_out:collected_by_owner')).toBe('Collected by you');
  });

  it('never names where a dispatch went', () => {
    expect(partnerMovementDetail('dispatch', null)).toBe('Left the warehouse');
  });

  it('says nothing for ordinary warehouse moves', () => {
    expect(partnerMovementDetail('transfer', null)).toBeNull();
    expect(partnerMovementDetail('adjust', 'cycle_count')).toBeNull();
  });
});
