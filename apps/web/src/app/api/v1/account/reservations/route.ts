import z from 'zod';

import getPartnerReservations from '@/app/_partnerApi/data/getPartnerReservations';
import parseQuery from '@/app/_partnerApi/utils/parseQuery';
import { OWN_STOCK_PERMISSION } from '@/app/_partners/schemas/createApiKeySchema';

import withPartnerKey from '../../_utils/withPartnerKey';

const reservationsQuerySchema = z.object({
  status: z.enum(['active', 'picked', 'released', 'all']).default('active'),
  updatedSince: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), 'must be an ISO-8601 date or date-time')
    .transform((value) => new Date(value))
    .optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/v1/account/reservations
 *
 * The key holder's stock held for orders: active holds by default, or picked,
 * released or all. Buyers are never named, only the order reference and kind.
 *
 * @example
 *   GET /api/v1/account/reservations?status=active
 */
export const GET = withPartnerKey(
  '/api/v1/account/reservations',
  OWN_STOCK_PERMISSION,
  ({ request, partnerId }) =>
    getPartnerReservations(partnerId, parseQuery(request, reservationsQuerySchema)),
);
