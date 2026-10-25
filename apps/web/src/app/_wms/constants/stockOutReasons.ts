/**
 * Why bottles are taken out of stock by hand, and what each means
 *
 * `settlement` decides the owner's statement: C&C buying at landed cost
 * (samples, marketing), C&C reimbursing at landed cost because the loss
 * happened in our care, a sale at a stated price, a withdrawal that is not a
 * sale, or a plain write-off when the bottles were C&C's own. `ownerSees` is
 * the only wording a client is ever shown; recipient and notes stay internal.
 */
const STOCK_OUT_REASONS = {
  samples: { label: 'Samples / trade samples', settlement: 'cc_landed', ownerSees: 'Sold', needsRecipient: true, needsPrice: false },
  marketing: { label: 'Marketing, event or tasting', settlement: 'cc_landed', ownerSees: 'Sold', needsRecipient: true, needsPrice: false },
  sold_outside_zoho: { label: 'Sold outside Zoho', settlement: 'price', ownerSees: 'Sold', needsRecipient: true, needsPrice: true },
  breakage: { label: 'Breakage / damaged', settlement: 'owner_reimbursed', ownerSees: 'Damaged in our care · reimbursed', needsRecipient: false, needsPrice: false },
  lost: { label: 'Lost / count shortfall', settlement: 'owner_reimbursed', ownerSees: 'Lost in our care · reimbursed', needsRecipient: false, needsPrice: false },
  collected_by_owner: { label: 'Collected by / returned to the owner', settlement: 'not_a_sale', ownerSees: 'Collected by you', needsRecipient: false, needsPrice: false },
  partner_samples: { label: 'Partner’s own samples or entertaining', settlement: 'not_a_sale', ownerSees: 'Taken for your samples / entertaining', needsRecipient: false, needsPrice: false },
} as const;

export type StockOutReason = keyof typeof STOCK_OUT_REASONS;

export default STOCK_OUT_REASONS;
