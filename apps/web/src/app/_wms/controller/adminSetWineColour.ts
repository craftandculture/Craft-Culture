import { z } from 'zod';

import db from '@/database/client';
import { productColours } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { WINE_COLOURS } from '../utils/wineColour';

/**
 * Set a wine's colour, for every vintage and size of it
 *
 * Needed where Liv-ex has no colour (our own internal codes, mixed cases) and
 * to correct Liv-ex where it is wrong. The colour set here wins over Liv-ex.
 *
 * @example
 *   await trpcClient.wms.admin.stock.setColour.mutate({ lwin7: '9000004', colour: 'red' });
 */
const adminSetWineColour = wmsOperatorProcedure
  .input(
    z.object({
      lwin7: z.string().regex(/^[0-9]{7}$/, 'A wine is identified by the first seven digits of its LWIN'),
      colour: z.enum(WINE_COLOURS),
    }),
  )
  .mutation(async ({ input: { lwin7, colour }, ctx: { user } }) => {
    await db
      .insert(productColours)
      .values({ lwin7, colour, setBy: user.id })
      .onConflictDoUpdate({
        target: productColours.lwin7,
        set: { colour, setBy: user.id, updatedAt: new Date() },
      });

    return { lwin7, colour };
  });

export default adminSetWineColour;
