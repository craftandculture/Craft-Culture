import { client } from '@/database/client';

let ready: boolean | null = null;

/**
 * Whether the closed-lines table has been created yet
 *
 * Applied after the build by `migrate.mjs`, which exits quietly when it cannot
 * reach the database, so its absence degrades to nothing having been closed
 * rather than taking the page down.
 *
 * @returns True when `cons_wine_closed` can be read
 */
const wineClosedReady = async () => {
  if (ready !== null) return ready;

  const [row] = await client<{ present: boolean }[]>`
    SELECT to_regclass('public.cons_wine_closed') IS NOT NULL AS present
  `;

  ready = row?.present ?? false;

  return ready;
};

export default wineClosedReady;
