import { and, eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import { productOffers, products } from '@/database/schema';

interface StockAvailability {
  productId: string;
  productName: string;
  lwin18: string | null;
  availableQuantity: number;
  source: 'local_inventory' | 'cultx';
}

/**
 * Check local stock availability for a list of products
 *
 * Queries the product offers to find which products are available
 * in local C&C inventory and their quantities.
 *
 * @param productIds - Array of product IDs to check
 * @returns Map of productId to availability info
 */
const checkLocalStockAvailability = async (
  productIds: string[],
): Promise<Map<string, StockAvailability>> => {
  if (productIds.length === 0) {
    return new Map();
  }

  // Query product offers for these products, prioritizing local_inventory
  const offers = await db
    .select({
      productId: productOffers.productId,
      productName: products.name,
      lwin18: products.lwin18,
      availableQuantity: productOffers.availableQuantity,
      source: productOffers.source,
    })
    .from(productOffers)
    .innerJoin(products, eq(productOffers.productId, products.id))
    .where(
      and(
        inArray(productOffers.productId, productIds),
        eq(productOffers.source, 'local_inventory'),
      ),
    );

  // Build availability map
  const availabilityMap = new Map<string, StockAvailability>();

  for (const offer of offers) {
    // If we already have an entry for this product, sum the quantities
    const existing = availabilityMap.get(offer.productId);
    if (existing) {
      existing.availableQuantity += offer.availableQuantity;
    } else {
      availabilityMap.set(offer.productId, {
        productId: offer.productId,
        productName: offer.productName,
        lwin18: offer.lwin18,
        availableQuantity: offer.availableQuantity,
        source: offer.source,
      });
    }
  }

  return availabilityMap;
};

export default checkLocalStockAvailability;
