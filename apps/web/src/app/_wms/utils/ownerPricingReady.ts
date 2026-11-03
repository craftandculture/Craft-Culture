import { client } from '@/database/client';

let ready = false;

/**
 * Whether `wms_owner_product_pricing` exists on this database
 *
 * `migrate.mjs` runs as postbuild and exits quietly without a database URL,
 * so a deploy can ship code that reads a table nobody created — which once
 * emptied this screen. Every read and write of per-owner pricing checks
 * first, and carries on with the shared row when the table is missing. Only
 * a yes is cached, so the next deploy's migration is picked up.
 *
 * @example
 *   if (await ownerPricingReady()) { ... }
 *
 * @returns Whether the table exists
 */
const ownerPricingReady = async () => {
  if (ready) return true;

  const [row] = await client<{ present: boolean }[]>`
    SELECT to_regclass('public.wms_owner_product_pricing') IS NOT NULL AS present
  `;

  ready = row?.present ?? false;

  return ready;
};

export default ownerPricingReady;
