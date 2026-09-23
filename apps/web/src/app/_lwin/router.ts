/**
 * LWIN Router
 *
 * API endpoints for LWIN (Liv-ex Wine Identification Number) lookup and management.
 * Used for identifying wines and building LWIN18 codes.
 */

import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminNextInternalLwin from './controller/adminNextInternalLwin';
import adminSearchLwin from './controller/adminSearchLwin';

const lwinRouter = createTRPCRouter({
  search: adminSearchLwin,
  nextInternal: adminNextInternalLwin,
});

export default lwinRouter;
