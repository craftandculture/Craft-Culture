import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { WAREHOUSE_WEBHOOK_ENV } from '../utils/postWarehouseSlack';

/**
 * Whether the #warehouse-activity feed is switched on in this deployment
 *
 * Reports only that the webhook is set, never its value, and posts nothing.
 *
 * @example
 *   const { configured } = await trpcClient.wms.adminWarehouseFeedStatus.query();
 */
const adminWarehouseFeedStatus = wmsOperatorProcedure.query(() => ({
  configured: Boolean(process.env[WAREHOUSE_WEBHOOK_ENV]),
}));

export default adminWarehouseFeedStatus;
