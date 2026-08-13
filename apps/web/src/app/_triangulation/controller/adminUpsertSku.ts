import { TRPCError } from '@trpc/server';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import mapImportLines from '../data/mapImportLines';
import { upsertSkuSchema } from '../schemas/triangulationSchemas';
import type { TriAliasSource } from '../schemas/triangulationSchemas';

/**
 * Create or update a canonical W code SKU
 *
 * `caseConfig` matters beyond presentation: it is what converts the
 * case-denominated packing list and Zoho lines into the bottles that the City
 * Drinks sales sheet is counted in. Changing it here re-bases those lines the
 * next time their import is mapped.
 */
const adminUpsertSku = adminProcedure
  .input(upsertSkuSchema)
  .mutation(async ({ input }) => {
    const {
      skuId,
      wCode,
      lwin18,
      productName,
      producer,
      vintage,
      bottleSize,
      caseConfig,
      notes,
    } = input;

    const trimmedCode = wCode.trim();

    const [clash] = await client<{ id: string }[]>`
      SELECT id FROM tri_skus
      WHERE w_code = ${trimmedCode} ${skuId ? client`AND id <> ${skuId}` : client``}
      LIMIT 1
    `;

    if (clash) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `W code "${trimmedCode}" is already in use`,
      });
    }

    if (skuId) {
      await client`
        UPDATE tri_skus
        SET w_code = ${trimmedCode},
            lwin18 = ${lwin18 ?? null},
            product_name = ${productName},
            producer = ${producer ?? null},
            vintage = ${vintage ?? null},
            bottle_size = ${bottleSize ?? null},
            case_config = ${caseConfig},
            notes = ${notes ?? null},
            updated_at = NOW()
        WHERE id = ${skuId}
      `;

      // Recalculate unconditionally, not only when the pack size moves. A SKU
      // whose pack was corrected while the recalculation was still broken now
      // holds the right pack over stale lines, and re-saving the same value is
      // the obvious way to repair that — so it has to actually do something.
      const affected = await client<{ id: string; aliasSource: TriAliasSource }[]>`
        SELECT DISTINCT i.id, i.alias_source AS "aliasSource"
        FROM tri_imports i
        JOIN tri_import_lines l ON l.import_id = i.id
        WHERE l.sku_id = ${skuId}
      `;

      for (const record of affected) {
        await mapImportLines(record.id, record.aliasSource);
      }

      return {
        id: skuId,
        wCode: trimmedCode,
        recalculatedImports: affected.length,
      };
    }

    const [created] = await client<{ id: string }[]>`
      INSERT INTO tri_skus (
        w_code, lwin18, product_name, producer, vintage,
        bottle_size, case_config, notes
      )
      VALUES (
        ${trimmedCode}, ${lwin18 ?? null}, ${productName}, ${producer ?? null},
        ${vintage ?? null}, ${bottleSize ?? null}, ${caseConfig}, ${notes ?? null}
      )
      RETURNING id
    `;

    return { id: created?.id ?? '', wCode: trimmedCode, recalculatedImports: 0 };
  });

export default adminUpsertSku;
