import { AbortTaskRunError, logger, schedules } from '@trigger.dev/sdk';

import createClient from '@/lib/cultx/client';

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
  },
});
