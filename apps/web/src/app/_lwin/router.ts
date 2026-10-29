/**
 * LWIN Router
 *
 * API endpoints for LWIN (Liv-ex Wine Identification Number) lookup and management.
 * Used for identifying wines and building LWIN18 codes.
 */

import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminNextInternalLwin from './controller/adminNextInternalLwin';
import adminReserveInternalLwin from './controller/adminReserveInternalLwin';
import adminSearchLwin from './controller/adminSearchLwin';
import adminSuggestLwin from './controller/adminSuggestLwin';

const lwinRouter = createTRPCRouter({
  search: adminSearchLwin,
  suggest: adminSuggestLwin,
  nextInternal: adminNextInternalLwin,
  reserveInternal: adminReserveInternalLwin,
});

export default lwinRouter;
