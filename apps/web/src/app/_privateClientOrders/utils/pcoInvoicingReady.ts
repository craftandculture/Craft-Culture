import { client } from '@/database/client';

let ready: boolean | null = null;

/**
 * Whether the pco_item_invoicing table exists yet
 *
 * migrate.mjs runs after the build and can quietly not run, so the first
 * deploy of a new table must not assume it. Cached once true; rechecked
 * while false so it comes good without a restart.
 */
const pcoInvoicingReady = async () => {
  if (ready) return true;
  const [row] = await client<{ present: boolean }[]>`
    SELECT to_regclass('public.pco_item_invoicing') IS NOT NULL AS present
  `;
  ready = Boolean(row?.present);
  return ready;
};

export default pcoInvoicingReady;
