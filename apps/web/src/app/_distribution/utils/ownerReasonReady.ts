import { client } from '@/database/client';

let ready: boolean | null = null;

/**
 * Whether `cons_movements.owner_reason` has actually been created yet
 *
 * Schema changes are applied by `migrate.mjs` after the build, which exits
 * quietly when it cannot reach the database — so a deploy can ship code that
 * reads a column nobody created, and selecting a missing column fails at parse
 * time, taking the page down rather than degrading. Asked once per process.
 *
 * @returns True when the column can be selected
 */
const ownerReasonReady = async () => {
  if (ready !== null) return ready;

  const [row] = await client<{ present: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'cons_movements' AND column_name = 'owner_reason'
    ) AS present
  `;

  ready = row?.present ?? false;

  return ready;
};

export default ownerReasonReady;
