import { client } from '@/database/client';

let ready: boolean | null = null;

/**
 * Whether owners can say when their City Drinks consignment is paid yet
 *
 * The column arrives with a migration that can fail to run on a deploy; until
 * it exists every owner is paid on the CD sale, as before. Only a positive
 * answer is remembered, so the column is picked up once it appears.
 *
 * @returns True once cons_owners.consignment_paid_on exists
 */
const paidOnReady = async () => {
  if (ready) return ready;

  const [row] = await client<{ present: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'cons_owners' AND column_name = 'consignment_paid_on'
    ) AS present
  `;

  ready = row?.present ?? false;

  return ready;
};

export default paidOnReady;
