import { client } from '@/database/client';

let ready: boolean | null = null;

/**
 * Whether the remembered landed-cost table exists yet
 *
 * `migrate.mjs` runs after the build and exits quietly without a database, so
 * its absence falls back to reading the Pricing Manager alone rather than
 * taking the statement down.
 *
 * @returns True when `cons_wine_landed` can be used
 */
const wineLandedReady = async () => {
  if (ready !== null) return ready;

  const [row] = await client<{ present: boolean }[]>`
    SELECT to_regclass('public.cons_wine_landed') IS NOT NULL AS present
  `;

  ready = row?.present ?? false;

  return ready;
};

export default wineLandedReady;
