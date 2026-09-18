import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import fetchCityDrinksStock from '../data/fetchCityDrinksStock';
import writeSnapshot from '../data/writeSnapshot';

interface OutletRow {
  id: string;
  name: string;
  connector: string;
  apiUrl: string | null;
  apiTokenEnv: string | null;
}

/**
 * Pull an outlet's stock position now
 *
 * The scheduled job does this daily; this is the button for when someone wants
 * the position as it stands rather than as it stood at two this morning.
 *
 * Daily rather than monthly matters: the feed carries no history and takes no
 * date, so a boundary missed is a month that can only ever come from an upload.
 *
 * @param outletId - The outlet to pull; omit for every API-connected outlet
 * @returns What each pull found, including anything unmatched
 */
const adminPullOutletStock = adminProcedure
  .input(z.object({ outletId: z.string().uuid().optional() }))
  .mutation(async ({ input }) => {
    const outlets = await client<OutletRow[]>`
      SELECT id, name, connector,
             api_url AS "apiUrl", api_token_env AS "apiTokenEnv"
      FROM cons_outlets
      WHERE is_active
        AND connector = 'api'
        ${input.outletId ? client`AND id = ${input.outletId}` : client``}
      ORDER BY name
    `;

    if (outlets.length === 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: input.outletId
          ? 'That outlet is not connected by API — its position arrives as an upload.'
          : 'No outlet is connected by API yet.',
      });
    }

    const results = [];

    for (const outlet of outlets) {
      /*
        One outlet failing must not cost the others their pull. The failure is
        returned rather than thrown so the caller sees which outlet, and why,
        beside the ones that worked.
      */
      try {
        const parsed = await fetchCityDrinksStock(outlet);
        const written = await writeSnapshot(outlet.id, parsed);

        results.push({ outlet: outlet.name, ok: true as const, ...written });
      } catch (error) {
        results.push({
          outlet: outlet.name,
          ok: false as const,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { results };
  });

export default adminPullOutletStock;
