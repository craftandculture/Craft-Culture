import { TRPCError } from '@trpc/server';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import insertRows from '../data/insertRows';
import resolveWmsOwner from '../data/resolveWmsOwner';
import { seedSkusFromWmsSchema } from '../schemas/triangulationSchemas';
import tokenizeMatch from '../utils/tokenizeMatch';

/**
 * Populate the SKU registry from stock the WMS already holds for an owner
 *
 * `wms_stock.supplier_sku` is where Crurated's W codes live, so the registry
 * can be bootstrapped from real warehouse data rather than retyped from a
 * packing list. Existing SKUs are left untouched — this only fills gaps, so it
 * is safe to re-run after each shipment lands.
 *
 * @returns How many SKUs were created and how many W codes were already known
 */
const adminSeedSkusFromWms = adminProcedure
  .input(seedSkusFromWmsSchema)
  .mutation(async ({ input }) => {
    const programmeId = input.programmeId;
    // The programme's configured owner, not whatever the browser sent
    const ownerName = await resolveWmsOwner(programmeId, input.ownerName);
    const tokens = tokenizeMatch(ownerName);

    // No tokens would match every owner's stock
    if (tokens.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Set the WMS owner for this client before seeding from the warehouse',
      });
    }

    const candidates = await client<
      {
        wCode: string;
        lwin18: string;
        productName: string;
        producer: string | null;
        vintage: number | null;
        bottleSize: string | null;
        caseConfig: number | null;
      }[]
    >`
      SELECT DISTINCT ON (s.supplier_sku)
        s.supplier_sku AS "wCode",
        s.lwin18,
        s.product_name AS "productName",
        s.producer,
        s.vintage,
        s.bottle_size AS "bottleSize",
        s.case_config AS "caseConfig"
      FROM wms_stock s
      WHERE s.supplier_sku IS NOT NULL
        AND TRIM(s.supplier_sku) <> ''
        AND NOT EXISTS (
          SELECT 1 FROM UNNEST(${tokens}::text[]) AS t(tok)
          -- Whole words only: "CRU" must not match "CRURATED"
          WHERE NOT (tok = ANY(REGEXP_SPLIT_TO_ARRAY(UPPER(COALESCE(s.owner_name, '')), '[^A-Z0-9]+')))
        )
      ORDER BY s.supplier_sku, s.received_at DESC NULLS LAST
    `;

    if (candidates.length === 0) {
      return { created: 0, skipped: 0, scanned: 0 };
    }

    const rows = candidates.map((candidate) => ({
      w_code: candidate.wCode.trim(),
      lwin18: candidate.lwin18,
      product_name: candidate.productName,
      producer: candidate.producer,
      vintage: candidate.vintage,
      bottle_size: candidate.bottleSize ?? '750ml',
      case_config: candidate.caseConfig && candidate.caseConfig > 0 ? candidate.caseConfig : 6,
      owner_name: ownerName,
      // The client the wines are seeded for, never the column default
      programme_id: programmeId,
    }));

    const inserted = await insertRows<{ id: string }>(
      'tri_skus',
      [
        'w_code',
        'lwin18',
        'product_name',
        'producer',
        'vintage',
        'bottle_size',
        'case_config',
        'owner_name',
        'programme_id',
      ],
      rows,
      { onConflict: '(programme_id, w_code) DO NOTHING', returning: 'id' },
    );

    return {
      created: inserted.length,
      skipped: candidates.length - inserted.length,
      scanned: candidates.length,
    };
  });

export default adminSeedSkusFromWms;
