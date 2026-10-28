import { AbortTaskRunError, logger, schedules } from '@trigger.dev/sdk';

import { productOffers, products } from '@/database/schema';
import conflictUpdateSet from '@/database/utils/conflictUpdateSet';
import createClient, { getCultxBaseUrl } from '@/lib/cultx/client';
import triggerDb from '@/trigger/triggerDb';
import getCountryFromRegion from '@/utils/getCountryFromRegion';
import splitArrayBatches from '@/utils/splitArrayBatches';

export const syncCultxProductsJob = schedules.task({
  id: 'sync-cultx-products',
  cron: {
    pattern: '0,30 * * * *',
    timezone: 'Asia/Dubai',
  },
  async run() {
    const baseUrl = getCultxBaseUrl();

    // No URL configured: skip rather than fall back to CultX's test gateway
    if (!baseUrl) {
      logger.warn('CultX sync skipped: CULTX_API_BASE_URL is not set');
      return { skipped: true };
    }

    if (/-uat-/i.test(baseUrl)) {
      logger.warn('CultX sync skipped: the configured URL is the UAT gateway', { baseUrl });
      return { skipped: true };
    }

    const cultxClient = createClient({ baseUrl });

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

      const result = await triggerDb
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

      // An offer without a market value is not written: a price of 0 reads
      // as free wine everywhere offers are shown
      const priced = batch.filter(
        (product) =>
          typeof product.marketValue === 'number' &&
          product.marketValue > 0 &&
          lwin18Map.has(product.lwin18),
      );

      if (priced.length < batch.length) {
        logger.info(`Skipped ${batch.length - priced.length} CultX offers with no price`);
      }

      if (!priced.length) continue;

      await triggerDb
        .insert(productOffers)
        .values(
          priced.map(
            (product) =>
              ({
                productId: lwin18Map.get(product.lwin18)!,
                externalId: `cultx:${product.productUrn}`,
                source: 'cultx',
                price: product.marketValue as number,
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

    return { skipped: false };
  },
});
