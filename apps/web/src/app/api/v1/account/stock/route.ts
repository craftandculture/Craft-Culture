import getPartnerHoldings from '@/app/_partnerApi/data/getPartnerHoldings';
import { OWN_STOCK_PERMISSION } from '@/app/_partners/schemas/createApiKeySchema';

import withPartnerKey from '../../_utils/withPartnerKey';

/**
 * GET /api/v1/account/stock
 *
 * What the key holder holds right now, one row per wine and place (our
 * warehouse, or with a distributor on consignment). See /docs/api.
 *
 * @example
 *   GET /api/v1/account/stock
 *   Authorization: Bearer cc_live_xxxxxxxxxxxxxxxx
 */
export const GET = withPartnerKey('/api/v1/account/stock', OWN_STOCK_PERMISSION, ({ partnerId }) =>
  getPartnerHoldings(partnerId),
);
