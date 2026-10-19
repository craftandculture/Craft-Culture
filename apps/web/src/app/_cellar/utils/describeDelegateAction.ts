/*
  What each committing action reads as, keyed by the end of its tRPC path.
  Anything not listed still reaches the holder, under the general wording.
*/
const ACTIONS: Record<string, string> = {
  saveRelease: 'saved a delivery request',
  submitRelease: 'requested a delivery',
  amendRelease: 'changed a delivery request',
  withdrawRelease: 'withdrew a delivery request',
  acceptRelease: 'accepted a delivery quotation',
  saveDeliveryAddress: 'updated the delivery address',
  offerForSale: 'offered wine for sale',
  withdrawMandate: 'withdrew an offer to sell',
  createPurchase: 'reserved wine from The Cellar List',
  markPurchasePaid: 'reported a payment for a purchase',
  cancelPurchase: 'cancelled a reservation',
  addIntake: 'added wine to bring into the cellar',
  requestConditionReport: 'asked for a condition report',
  saveAddress: 'saved a delivery address',
  deleteAddress: 'removed a delivery address',
  requestUkMove: 'asked to move wine from the UK to the UAE',
  withdrawUkMove: 'withdrew a request to move wine to the UAE',
  acceptUkMove: 'accepted the price to move wine to the UAE',
  createRequest: 'asked us to find a wine',
  withdrawRequest: 'withdrew a request to find a wine',
  respondOffer: 'replied to our offer for a wine you asked us to find',
  registerInterest: 'registered interest in an allocation',
  respondAllocation: 'replied to an allocation',
};

/**
 * The words for something a delegate did, as the holder will read them
 *
 * @example
 *   describeDelegateAction('cellar.member.submitRelease'); // 'requested a delivery'
 *
 * @param path - The tRPC procedure path
 * @returns A phrase that follows the delegate's name
 */
const describeDelegateAction = (path: string) => {
  const name = path.split('.').pop() ?? '';

  return ACTIONS[name] ?? 'made a change in your private cellar';
};

export default describeDelegateAction;
