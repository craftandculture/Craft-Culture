import getPartnerMovementEvents from '@/app/_partnerApi/data/getPartnerMovementEvents';
import movementsQuerySchema from '@/app/_partnerApi/schemas/movementsQuerySchema';
import parseQuery from '@/app/_partnerApi/utils/parseQuery';
import { OWN_STOCK_PERMISSION } from '@/app/_partners/schemas/createApiKeySchema';

import withPartnerKey from '../../_utils/withPartnerKey';

/**
 * GET /api/v1/account/sales
 *
 * The key holder's wine that has been sold out of our warehouse: picked for a
 * distributor or private-client order, bought by Craft & Culture, or taken out
 * of stock as a sale. Same events and cursor as /account/movements, sales only.
 * A page can hold fewer rows than `limit`; keep paging while `hasMore`.
 *
 * @example
 *   GET /api/v1/account/sales?since=2026-11-01
 */
export const GET = withPartnerKey(
  '/api/v1/account/sales',
  OWN_STOCK_PERMISSION,
  ({ request, partnerId }) =>
    getPartnerMovementEvents(partnerId, {
      ...parseQuery(request, movementsQuerySchema),
      salesOnly: true,
    }),
);
