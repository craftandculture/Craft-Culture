import { AbortTaskRunError, logger, schedules } from '@trigger.dev/sdk';

import db from '@/database/client';
import { productOffers, products } from '@/database/schema';
import conflictUpdateSet from '@/database/utils/conflictUpdateSet';
import createClient from '@/lib/cultx/client';
import getCountryFromRegion from '@/utils/getCountryFromRegion';
import splitArrayBatches from '@/utils/splitArrayBatches';

export const syncCultxProductsJob = schedules.task({
  id: 'sync-cultx-products',
  cron: {
    pattern: '0,30 * * * *',
    timezone: 'Asia/Dubai',
  },
  async run() {
    const cultxClient = createClient();

    const response = await cultxClient.GET('/CultxActiveMarkets', {
      params: {
        query: {
          page: 0,
          pageSize: 9999,
        },
      },
    });

    if (response.error) {
      logger.error('Failed to sync products from CultX', {
        error: response.error,
      });
      throw new AbortTaskRunError('Failed to sync products from CultX');
    }

    if (!response.data) {
      logger.error('No data returned from CultX');
      throw new AbortTaskRunError('No data returned from CultX');
    }

    logger.info(`Syncing ${response.data.count} products from CultX`);

    const productBatches = splitArrayBatches(response.data.data, 100);

    for (const [index, batch] of productBatches.entries()) {
      logger.info(
        `Processing batch ${index + 1} out of ${productBatches.length}`,
      );

      const result = await db
        .insert(products)
        .values(
          batch.map((product) => ({
            lwin18: product.lwin18,
            name: product.wineName,
            region: product.region,
            producer: product.producer,
            country: getCountryFromRegion(product.region, product.producer),
            year: product.vintage,
            imageUrl: product.imageFileName
              ? `https://cwcdst2prdctimgimprtfnct.blob.core.windows.net/height/800/${product.imageFileName}`
              : null,
          })),
        )
        .onConflictDoUpdate({
          target: products.lwin18,
          set: conflictUpdateSet(products, [
            'name',
            'region',
            'producer',
            'country',
            'year',
            'imageUrl',
          ]),
        })
        .returning();

      const lwin18Map = new Map(
        result.map((product) => [product.lwin18, product.id]),
      );

      await db
        .insert(productOffers)
        .values(
          batch.map(
            (product) =>
              ({
                productId: lwin18Map.get(product.lwin18)!,
                externalId: `cultx:${product.productUrn}`,
                source: 'cultx',
                price: product.marketValue ?? 0,
                currency: 'GBP',
                unitCount: product.unitCount,
                unitSize: product.unitSize,
                availableQuantity: product.availableQuantity,
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
    }
  },
});
