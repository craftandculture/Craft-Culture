import { client } from '@/database/client';

let ready: boolean | null = null;

/**
 * Whether the bought-lines table has been created yet
 *
 * Applied after the build by `migrate.mjs`, which exits quietly when it cannot
 * reach the database. Reading a missing table fails at parse time and would
 * take the whole page down, so it is asked once per process and the feature
 * degrades to nobody having tagged anything.
 *
 * @returns True when `cons_wine_bought` can be read
 */
const wineBoughtReady = async () => {
  if (ready !== null) return ready;

  const [row] = await client<{ present: boolean }[]>`
    SELECT to_regclass('public.cons_wine_bought') IS NOT NULL AS present
  `;

  ready = row?.present ?? false;

  return ready;
};

export default wineBoughtReady;
