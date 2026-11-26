import { client } from '@/database/client';

let ready: boolean | null = null;

/**
 * Whether the codes register can hold an opening position yet
 *
 * The columns arrive with a migration that can fail to run on a deploy; until
 * they exist the register is written and read without them. Only a positive
 * answer is remembered, so the columns are picked up once they appear.
 *
 * @returns True once the register and invoice lines can hold an opening
 */
const openingReady = async () => {
  if (ready) return ready;

  const [row] = await client<{ present: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'cons_outlet_codes' AND column_name = 'opening_at'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'cons_movements' AND column_name = 'opening_bottles'
    ) AS present
  `;

  ready = row?.present ?? false;

  return ready;
};

export default openingReady;
