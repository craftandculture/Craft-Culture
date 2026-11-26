import getPartnerMovementEvents from '@/app/_partnerApi/data/getPartnerMovementEvents';
import movementsQuerySchema from '@/app/_partnerApi/schemas/movementsQuerySchema';
import parseQuery from '@/app/_partnerApi/utils/parseQuery';
import { OWN_STOCK_PERMISSION } from '@/app/_partners/schemas/createApiKeySchema';

import withPartnerKey from '../../_utils/withPartnerKey';

/**
 * GET /api/v1/account/movements
 *
 * Every event on the key holder's stock, oldest first, paged by cursor: what
 * arrived, was picked, sold, transferred, corrected. Store `meta.nextCursor`
 * and call again with it to receive only what has happened since.
 *
 * @example
 *   GET /api/v1/account/movements?since=2026-01-01&limit=200
 *   GET /api/v1/account/movements?cursor=MjAyNi0xMS0y...
 */
export const GET = withPartnerKey(
  '/api/v1/account/movements',
  OWN_STOCK_PERMISSION,
  ({ request, partnerId }) =>
    getPartnerMovementEvents(partnerId, parseQuery(request, movementsQuerySchema)),
);
