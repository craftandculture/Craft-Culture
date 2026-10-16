import { client } from '@/database/client';

let ready: boolean | null = null;

/**
 * Whether the unmatched-lines table exists yet
 *
 * `migrate.mjs` runs after the build and exits quietly when it cannot reach
 * the database, so its absence degrades to nothing being recorded rather than
 * taking the import down with it.
 *
 * @returns True when `cons_import_unmatched` can be used
 */
const unmatchedReady = async () => {
  if (ready !== null) return ready;

  const [row] = await client<{ present: boolean }[]>`
    SELECT to_regclass('public.cons_import_unmatched') IS NOT NULL AS present
  `;

  ready = row?.present ?? false;

  return ready;
};

export default unmatchedReady;
