import STOCK_OUT_REASONS from '../constants/stockOutReasons';

/**
 * The only description of a movement a partner is shown
 *
 * A movement's own notes are for staff: a dispatch names the distributor it
 * went to, and a take-out records who the bottles went to and why. Partners
 * never see either (Index 3.0: no counterparty names), so this says what
 * happened to their bottles in their words, or nothing.
 *
 * @example
 *   partnerMovementDetail('adjust', 'stock_out:marketing'); // 'Sold'
 *   partnerMovementDetail('dispatch', null); // 'Left the warehouse'
 *
 * @param movementType - The movement's type
 * @param reasonCode - Its reason code, if any
 * @returns A partner-safe description, or null
 */
const partnerMovementDetail = (movementType: string, reasonCode: string | null) => {
  if (reasonCode?.startsWith('stock_out:')) {
    const reason = reasonCode.slice('stock_out:'.length) as keyof typeof STOCK_OUT_REASONS;
    return STOCK_OUT_REASONS[reason]?.ownerSees ?? 'Taken out of stock';
  }
  if (movementType === 'dispatch') return 'Left the warehouse';
  if (movementType === 'ownership_transfer') return 'Ownership transferred';
  if (movementType === 'pick') return 'Picked for an order';
  return null;
};

export default partnerMovementDetail;
