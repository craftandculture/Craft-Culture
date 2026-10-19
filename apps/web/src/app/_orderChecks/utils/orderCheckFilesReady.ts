import { client } from '@/database/client';

let ready: boolean | null = null;

/**
 * Whether the order-check table has been created yet
 *
 * Applied after the build by `migrate.mjs`, which exits quietly when it cannot
 * reach the database. Until it exists the check still runs on an LPO attached
 * for that one check; it simply cannot be kept, listed or signed off.
 *
 * @returns True when `order_check_files` can be read
 */
const orderCheckFilesReady = async () => {
  if (ready) return ready;

  const [row] = await client<{ present: boolean }[]>`
    SELECT to_regclass('public.order_check_files') IS NOT NULL AS present
  `;

  ready = row?.present ?? false;

  return ready;
};

export default orderCheckFilesReady;
