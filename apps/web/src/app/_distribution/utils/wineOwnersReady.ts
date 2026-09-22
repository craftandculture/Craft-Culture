import { client } from '@/database/client';

let ready: boolean | null = null;

/**
 * Whether the per-wine owner table has been created yet
 *
 * Applied after the build by `migrate.mjs`, which exits quietly when it cannot
 * reach the database. Reading a missing table fails at parse time and would
 * take the sync down, so it is asked for once per process and the override
 * path stubs out when absent.
 *
 * @returns True when `cons_wine_owners` can be read
 */
const wineOwnersReady = async () => {
  if (ready !== null) return ready;

  const [row] = await client<{ present: boolean }[]>`
    SELECT to_regclass('public.cons_wine_owners') IS NOT NULL AS present
  `;

  ready = row?.present ?? false;

  return ready;
};

export default wineOwnersReady;
