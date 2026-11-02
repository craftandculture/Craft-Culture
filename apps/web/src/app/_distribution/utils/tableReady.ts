import { client } from '@/database/client';

const known = new Map<string, boolean>();

/**
 * Whether a table the migrations add actually exists yet
 *
 * `migrate.mjs` runs as postbuild and exits quietly when it cannot reach the
 * database, so a deploy can ship code that reads a table nobody created. A
 * read against a missing table fails, the query retries and gives up, and the
 * screen shows nothing at all — so every new table is checked before it is
 * relied on, and code that finds it absent carries on without it.
 *
 * Only a positive answer is cached: a table that is missing now can be
 * created by the next deploy's migration without a restart.
 *
 * @example
 *   if (await tableReady('cons_invoice_types')) { ... }
 *
 * @param name - The table, unqualified, in the public schema
 * @returns Whether it exists
 */
const tableReady = async (name: string) => {
  if (known.get(name)) return true;

  const [row] = await client<{ present: boolean }[]>`
    SELECT to_regclass(${`public.${name}`}) IS NOT NULL AS present
  `;

  const present = row?.present ?? false;

  if (present) known.set(name, true);

  return present;
};

export default tableReady;
