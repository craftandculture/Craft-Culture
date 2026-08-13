import parseSkuPack from '@/app/_wms/utils/parseSkuPack';
import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import mapImportLines from '../data/mapImportLines';
import { autoMapSchema } from '../schemas/triangulationSchemas';
import type { TriAliasSource } from '../schemas/triangulationSchemas';

interface PackCandidate {
  id: string;
  wCode: string;
  productName: string;
  lwin18: string | null;
  caseConfig: number;
}

/**
 * Correct pack sizes from the LWIN, which states them
 *
 * Pack size is the quietest way to be wrong in this tool: it turns a
 * case-denominated line into bottles, so a spirit sitting at the 6-bottle
 * default when its real pack is 1 overstates that SKU six-fold — and the
 * resulting figure looks entirely plausible. Nothing on screen makes a wrong
 * pack size look wrong.
 *
 * An LWIN18 encodes the pack in its own digits, and supplier W codes carry the
 * same segments, so either can say what the pack actually is rather than the
 * SKU inheriting a default chosen for wine. `parseSkuPack` rejects implausible
 * values, so a corrupt code is skipped rather than trusted.
 *
 * Every changed SKU has its imports recalculated, since the figures are stale
 * the moment the pack size moves.
 */
const adminRepairPackSizes = adminProcedure
  .input(autoMapSchema)
  .mutation(async ({ input }) => {
    const { dryRun } = input;

    const skus = await client<PackCandidate[]>`
      SELECT id, w_code AS "wCode", product_name AS "productName",
             lwin18, case_config AS "caseConfig"
      FROM tri_skus
    `;

    const changes: {
      wCode: string;
      productName: string;
      from: number;
      to: number;
    }[] = [];

    for (const sku of skus) {
      // The LWIN states the pack; supplier W codes carry the same segments
      // (`W12008024-2021-06-00750`), which is the only source for a SKU that
      // never got an LWIN. parseSkuPack rejects implausible packs either way.
      const parsed = parseSkuPack(sku.lwin18) ?? parseSkuPack(sku.wCode);

      if (!parsed || parsed.pack === sku.caseConfig) {
        continue;
      }

      changes.push({
        wCode: sku.wCode,
        productName: sku.productName,
        from: sku.caseConfig,
        to: parsed.pack,
      });

      if (dryRun) {
        continue;
      }

      await client`
        UPDATE tri_skus
        SET case_config = ${parsed.pack}, updated_at = NOW()
        WHERE id = ${sku.id}
      `;
    }

    if (dryRun || changes.length === 0) {
      return { dryRun, changed: changes.length, recalculated: 0, examples: changes.slice(0, 10) };
    }

    // Every figure these SKUs appear in was computed at the old pack size.
    const affected = await client<{ id: string; aliasSource: TriAliasSource }[]>`
      SELECT DISTINCT i.id, i.alias_source AS "aliasSource"
      FROM tri_imports i
      JOIN tri_import_lines l ON l.import_id = i.id
      JOIN tri_skus s ON s.id = l.sku_id
    `;

    for (const record of affected) {
      await mapImportLines(record.id, record.aliasSource);
    }

    return {
      dryRun,
      changed: changes.length,
      recalculated: affected.length,
      examples: changes.slice(0, 10),
    };
  });

export default adminRepairPackSizes;
