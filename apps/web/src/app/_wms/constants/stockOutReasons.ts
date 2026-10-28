/**
 * Why bottles are taken out of stock by hand, and what each means
 *
 * `settlement` decides the owner's statement: C&C buying at landed cost
 * (samples, marketing), C&C reimbursing at landed cost because the loss
 * happened in our care, a sale at a stated price, a withdrawal that is not a
 * sale, or a plain write-off when the bottles were C&C's own. `ownerSees` is
 * the only wording a client is ever shown; recipient and notes stay internal.
 * `detailLabel` names the one free-text field for that reason (who it went
 * to, or what happened), so a breakage is never recorded as "went to C&C".
 */
const STOCK_OUT_REASONS = {
  samples: { label: 'Samples / trade samples', settlement: 'cc_landed', ownerSees: 'Sold', needsRecipient: true, needsPrice: false, detailLabel: 'Given to', detailHint: 'Client, buyer or person' },
  marketing: { label: 'Marketing, event or tasting', settlement: 'cc_landed', ownerSees: 'Sold', needsRecipient: true, needsPrice: false, detailLabel: 'Used at', detailHint: 'Event or tasting' },
  sold_outside_zoho: { label: 'Sold outside Zoho', settlement: 'price', ownerSees: 'Sold', needsRecipient: true, needsPrice: true, detailLabel: 'Sold to', detailHint: 'Buyer' },
  breakage: { label: 'Breakage / damaged', settlement: 'owner_reimbursed', ownerSees: 'Damaged in our care · reimbursed', needsRecipient: true, needsPrice: false, detailLabel: 'What happened', detailHint: 'e.g. dropped at putaway, corked, leaking' },
  lost: { label: 'Lost / count shortfall', settlement: 'owner_reimbursed', ownerSees: 'Lost in our care · reimbursed', needsRecipient: true, needsPrice: false, detailLabel: 'What happened', detailHint: 'e.g. not found at count on 24 Oct' },
  collected_by_owner: { label: 'Collected by / returned to the owner', settlement: 'not_a_sale', ownerSees: 'Collected by you', needsRecipient: false, needsPrice: false, detailLabel: 'Collected by', detailHint: 'Name of the person collecting' },
  partner_samples: { label: 'Partner’s own samples or entertaining', settlement: 'not_a_sale', ownerSees: 'Taken for your samples / entertaining', needsRecipient: false, needsPrice: false, detailLabel: 'Purpose', detailHint: 'Tasting, sales samples, entertaining' },
} as const;

export type StockOutReason = keyof typeof STOCK_OUT_REASONS;

export default STOCK_OUT_REASONS;
