import { inArray } from 'drizzle-orm';

import settingsGetController from '@/app/_admin/controllers/settingsGetController';
import downloadGoogleSheet from '@/app/_pricingModels/utils/downloadGoogleSheet';
import db from '@/database/client';
import { productOffers, products } from '@/database/schema';
import conflictUpdateSet from '@/database/utils/conflictUpdateSet';
import splitArrayBatches from '@/utils/splitArrayBatches';

import parseLocalInventorySheet from '../utils/parseLocalInventorySheet';

/**
 * Sync result statistics
 */
export interface SyncResult {
  productsCreated: number;
  productsUpdated: number;
  offersCreated: number;
  offersUpdated: number;
  offersDeleted: number;
  totalItems: number;
  errors: string[];
}

/**
 * Sync local inventory from Google Sheet to database
 *
 * Process:
 * 1. Fetch Google Sheet ID from settings
 * 2. Download and parse the sheet
 * 3. Batch process products (100 per batch)
 * 4. Upsert products by LWIN18
 * 5. Upsert product offers with source='local_inventory'
 * 6. Delete orphaned local_inventory offers
 * 7. Return sync statistics
 *
 * @returns Sync result with statistics
 */
const localInventorySyncController = async () => {
  const stats: SyncResult = {
    productsCreated: 0,
    productsUpdated: 0,
    offersCreated: 0,
    offersUpdated: 0,
    offersDeleted: 0,
    totalItems: 0,
    errors: [],
  };

  try {
    // 1. Get Google Sheet ID from settings
    const googleSheetId = await settingsGetController({
      key: 'localInventorySheetId',
    });

    if (!googleSheetId) {
      throw new Error(
        'Local inventory sheet not configured. Please add the Google Sheet URL in admin settings.',
      );
    }

    // 2. Download the sheet
    const buffer = await downloadGoogleSheet(googleSheetId);

    // 3. Parse the sheet
    const items = await parseLocalInventorySheet(buffer);

    if (items.length === 0) {
      throw new Error('No inventory items found in the sheet');
    }

    stats.totalItems = items.length;

    // 4. Batch process items (100 per batch like CultX sync)
    const batches = splitArrayBatches(items, 100);

    const processedExternalIds: string[] = [];

    for (const [index, batch] of batches.entries()) {
      console.log(`Processing batch ${index + 1} of ${batches.length}`);

      try {
        // Deduplicate products within this batch by LWIN18
        // (same wine can appear multiple times with different offers)
        const uniqueProducts = Array.from(
          new Map(
            batch.map((item) => [
              item.lwin18,
              {
                lwin18: item.lwin18,
                name: item.productName,
                region: item.region,
                producer: null,
                country: item.country,
                year: item.year,
                imageUrl: null,
              },
            ])
          ).values()
        );

        // Upsert products
        const upsertedProducts = await db
          .insert(products)
          .values(uniqueProducts)
          .onConflictDoUpdate({
            target: products.lwin18,
            set: conflictUpdateSet(products, [
              'name',
              'region',
              'country',
              'year',
            ]),
          })
          .returning();

        // Track externalIds for orphan cleanup
        processedExternalIds.push(
          ...batch.map((item) => `local:${item.lwin18}:row${item.rowNumber}`)
        );

        // Map LWIN18 to product ID
        const lwin18Map = new Map(
          upsertedProducts.map((product) => [product.lwin18, product.id]),
        );

        // Upsert product offers
        await db
          .insert(productOffers)
          .values(
            batch.map(
              (item) =>
                ({
                  productId: lwin18Map.get(item.lwin18)!,
                  externalId: `local:${item.lwin18}:row${item.rowNumber}`,
                  source: 'local_inventory',
                  price: item.price,
                  currency: item.currency,
                  unitCount: item.bottlesPerCase,
                  unitSize: item.bottleSize,
                  availableQuantity: item.availableQuantity,
                }) as const,
            ),
          )
          .onConflictDoUpdate({
            target: productOffers.externalId,
            set: conflictUpdateSet(productOffers, [
              'price',
              'currency',
              'unitCount',
              'unitSize',
              'availableQuantity',
            ]),
          });

        // Update stats (rough approximation - some may be updates)
        stats.productsCreated += upsertedProducts.length;
        stats.offersCreated += batch.length;
      } catch (error) {
        const errorMessage = `Error processing batch ${index + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMessage);
        stats.errors.push(errorMessage);
      }
    }

    // 5. Delete orphaned local_inventory offers
    // (offers that exist in DB but not in current sheet)

    // Get all existing local_inventory offers
    const existingOffers = await db.query.productOffers.findMany({
      where: {
        source: 'local_inventory',
      },
    });

    // Find offers to delete (exist in DB but not in current sync)
    const offersToDelete = existingOffers
      .filter((offer) => !processedExternalIds.includes(offer.externalId))
      .map((offer) => offer.id);

    if (offersToDelete.length > 0) {
      await db
        .delete(productOffers)
        .where(inArray(productOffers.id, offersToDelete));
      stats.offersDeleted = offersToDelete.length;
    }

    console.log('Local inventory sync completed', stats);
    return stats;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    stats.errors.push(errorMessage);
    throw error;
  }
};

export default localInventorySyncController;
