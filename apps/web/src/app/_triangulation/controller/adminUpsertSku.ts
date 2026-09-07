import { TRPCError } from '@trpc/server';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import mapImportLines from '../data/mapImportLines';
import { upsertSkuSchema } from '../schemas/triangulationSchemas';
import type { TriAliasSource } from '../schemas/triangulationSchemas';
import resolveProgrammeId from '../utils/programmeId';

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
    const programmeId = resolveProgrammeId(input.programmeId);
    const {
      skuId,
      wCode,
      lwin18,
      productName,
      producer,
      vintage,
      bottleSize,
      caseConfig,
      ownerName,
      notes,
    } = input;

    /*
      Only Crurated issue W codes, so a wine can perfectly well have none and
      be identified by its LWIN instead. Null rather than empty string: the
      unique index treats nulls as distinct, so any number of LWIN-identified
      wines coexist, while two empty strings would collide.
    */
    const trimmedCode = wCode?.trim() ? wCode.trim() : null;

    if (!trimmedCode && !lwin18) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'A wine needs either a W code or a LWIN to be identified. Neither was given.',
      });
    }

    if (trimmedCode) {
      /*
        Scoped to the programme, matching the unique index. Unscoped, one
        client's house code blocked another's — and two clients numbering
        their own wines from 1 is the normal case, not an unlucky one.
      */
      const [clash] = await client<{ id: string }[]>`
        SELECT id FROM tri_skus
        WHERE w_code = ${trimmedCode}
          AND programme_id = ${programmeId}
          ${skuId ? client`AND id <> ${skuId}` : client``}
        LIMIT 1
      `;

      if (clash) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `W code "${trimmedCode}" is already in use`,
        });
      }
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
            -- Whose wine it is. Left alone when not supplied, so an edit that
            -- says nothing about ownership does not silently reassign it.
            owner_name = COALESCE(${ownerName ?? null}, owner_name),
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
        programme_id, w_code, lwin18, product_name, producer, vintage,
        bottle_size, case_config, owner_name, notes
      )
      VALUES (
        -- Without this the row took the column default, so a wine added from
        -- any client's tab was created in Crurated's registry and vanished
        -- from the one it was typed into.
        ${programmeId},
        ${trimmedCode}, ${lwin18 ?? null}, ${productName}, ${producer ?? null},
        ${vintage ?? null}, ${bottleSize ?? null}, ${caseConfig},
        -- Null defers to the column default. Forcing 'Crurated' here made
        -- every client's wine claim Crurated as its owner, which is the
        -- fault that made a per-owner split impossible in the first place.
        ${ownerName ?? null}, ${notes ?? null}
      )
      RETURNING id
    `;

    return { id: created?.id ?? '', wCode: trimmedCode, recalculatedImports: 0 };
  });

export default adminUpsertSku;
