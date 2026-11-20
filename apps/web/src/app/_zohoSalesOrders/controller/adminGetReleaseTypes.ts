import { z } from 'zod';

import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import getReleaseTypes from '../data/getReleaseTypes';

/**
 * The release type of each sales order, for the release screen
 *
 * @param salesOrderIds - The orders on screen
 * @returns The type set or suggested, and whether one must be chosen
 */
const adminGetReleaseTypes = wmsOperatorProcedure
  .input(z.object({ salesOrderIds: z.array(z.string().uuid()).max(500) }))
  .query(async ({ input }) => getReleaseTypes(input.salesOrderIds));

export default adminGetReleaseTypes;
