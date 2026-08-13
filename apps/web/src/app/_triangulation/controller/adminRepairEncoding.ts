import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import { autoMapSchema } from '../schemas/triangulationSchemas';
import repairMojibake from '../utils/repairMojibake';

/**
 * Repair wine names left garbled by a mis-decoded upload
 *
 * A CSV without a byte-order mark was being decoded as Windows-1252, so every
 * accent arrived as mojibake and was stored that way — `L’If` as `Lâ€™If`,
 * `Côtes` as `CÃ´tes`. The parser now forces UTF-8, which stops it recurring;
 * this fixes what already went in.
 *
 * Names are only rewritten where the damage is unambiguous, so a name that was
 * always correct is never touched. Matching is unaffected either way, since
 * every comparison strips punctuation before comparing — this is about a
 * registry someone has to read, and a name they cannot search for.
 */
const adminRepairEncoding = adminProcedure
  .input(autoMapSchema)
  .mutation(async ({ input }) => {
    const { dryRun } = input;

    const rows = await client<
      { id: string; productName: string; producer: string | null }[]
    >`
      SELECT id, product_name AS "productName", producer
      FROM tri_skus
    `;

    const repaired: { from: string; to: string }[] = [];

    for (const row of rows) {
      const productName = repairMojibake(row.productName);
      const producer = row.producer ? repairMojibake(row.producer) : null;

      if (productName === row.productName && producer === row.producer) {
        continue;
      }

      repaired.push({ from: row.productName, to: productName });

      if (!dryRun) {
        await client`
          UPDATE tri_skus
          SET product_name = ${productName},
              producer = ${producer},
              updated_at = NOW()
          WHERE id = ${row.id}
        `;
      }
    }

    return {
      dryRun,
      repaired: repaired.length,
      scanned: rows.length,
      examples: repaired.slice(0, 8),
    };
  });

export default adminRepairEncoding;
