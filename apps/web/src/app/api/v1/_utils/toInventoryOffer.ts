import type { productOffers } from '@/database/schema';

import type { InventoryItem } from '../inventory/schema';

/**
 * One product offer as the inventory API returns it
 *
 * Mirrors the catalogue route's partner-feed rule: a key holding
 * `feed:partner` sees the book as one supplier. The offer's source (which
 * marketplace or stock pool it comes from) is withheld, and so is the stored
 * offer price, which is the pre-margin base the platform prices from, not a
 * trade price. Partners get trade pricing from /api/v1/catalogue.
 *
 * @param offer - The stored offer
 * @param partnerFeed - Whether the key is a partner feed key
 * @returns The offer for the response
 */
const toInventoryOffer = (
  offer: typeof productOffers.$inferSelect,
  partnerFeed: boolean,
): InventoryItem['offers'][number] => ({
  id: offer.id,
  ...(partnerFeed
    ? {}
    : { source: offer.source, price: offer.price, currency: offer.currency }),
  unitCount: offer.unitCount,
  unitSize: offer.unitSize,
  availableQuantity: offer.availableQuantity,
  inStock: offer.availableQuantity > 0,
});

export default toInventoryOffer;
