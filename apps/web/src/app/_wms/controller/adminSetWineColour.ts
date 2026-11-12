import { z } from 'zod';

import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { WINE_KEY_PATTERN } from '../data/getWineColours';
import saveWineColour from '../data/saveWineColour';
import { WINE_COLOURS } from '../utils/wineColour';

/**
 * Set a wine's colour, for every vintage and size of it
 *
 * Needed where Liv-ex has no colour (our own internal codes, supplier codes,
 * mixed cases) and to correct Liv-ex where it is wrong. The colour set here
 * wins over Liv-ex.
 *
 * @example
 *   await trpcClient.wms.admin.stock.setColour.mutate({ lwin7: '9000004', colour: 'red' });
 */
const adminSetWineColour = wmsOperatorProcedure
  .input(
    z.object({
      lwin7: z.string().regex(WINE_KEY_PATTERN, 'A wine is identified by the code before the first dash'),
      colour: z.enum(WINE_COLOURS),
    }),
  )
  .mutation(async ({ input: { lwin7, colour }, ctx: { user } }) => {
    await saveWineColour(lwin7, colour, user.id);

    return { lwin7, colour };
  });

export default adminSetWineColour;
