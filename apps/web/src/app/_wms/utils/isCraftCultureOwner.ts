/**
 * Whether a stock owner is Craft & Culture itself
 *
 * Owners are told apart by name across the catalogue and pricing, because C&C
 * is one partner record among many and has been merged and renamed before. Kept
 * in one place so the catalogue's house rates and the question "who is owed for
 * this sale" can never disagree about which stock is ours.
 *
 * @example
 *   isCraftCultureOwner('Craft & Culture'); // true
 *   isCraftCultureOwner('Philipp Strasky'); // false
 *
 * @param owner - The owner's name as held on the stock row or partner
 * @returns True for C&C's own stock
 */
const isCraftCultureOwner = (owner: string | null | undefined) =>
  !!owner && /craft.*culture/i.test(owner);

export default isCraftCultureOwner;
