import { z } from 'zod';

import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import getWineColours from '../data/getWineColours';

/**
 * Each wine's colour (red, white, rosé, sparkling, fortified, orange), keyed by
 * the wine's code (its LWIN7, or the code before the first dash), and the
 * wines still without one
 *
 * With no input it covers every wine held in stock, which is what Stock
 * Explorer shows and counts. Pricing Manager passes the wines on its page,
 * because it also lists wine still on its way.
 *
 * @example
 *   await trpcClient.wms.admin.stock.colours.query({ lwin7s: ['1009613'] });
 */
const adminGetWineColours = wmsOperatorProcedure
  .input(z.object({ lwin7s: z.array(z.string()).max(500).optional() }).optional())
  .query(async ({ input }) => getWineColours(input?.lwin7s));

export default adminGetWineColours;
