import { TRPCError } from '@trpc/server';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import resolveWmsOwner from '../data/resolveWmsOwner';
import swapFeedImport from '../data/swapFeedImport';
import { syncCountFromWmsSchema } from '../schemas/triangulationSchemas';
import normalizeCode from '../utils/normalizeCode';
import resolveProgrammeId from '../utils/programmeId';
import tokenizeMatch from '../utils/tokenizeMatch';

interface WmsReceiptRow {
  code: string | null;
  productName: string;
  vintage: number | null;
  caseConfig: number | null;
  quantityCases: number;
  bottles: number;
  movedAt: string;
  movementNumber: string;
}

/**
 * Take C&C's opening stock from the WMS receiving ledger
 *
 * A packing list is what a shipment contained, and receiving is where that
 * same list is keyed into the WMS — so `wms_stock_movements` already holds it,
 * per case, dated, without anyone re-typing a PDF.
 *
 * Every receipt keeps its own movement date on the line, so a single import
 * covers all of history and still reconciles correctly period by period. That
 * is also why it belongs to no period: it is a ledger, not a month's file, and
 * a closed period stays stable because its cut-off simply excludes anything
 * received later. Refreshing replaces the whole feed rather than appending.
 */
const adminSyncReceiptsFromWms = adminProcedure
  .input(syncCountFromWmsSchema)
  .mutation(async ({ input, ctx }) => {
    const programmeId = resolveProgrammeId(input.programmeId);
    // The programme's configured owner, not whatever the browser sent
    const ownerName = await resolveWmsOwner(programmeId, input.ownerName);
    const asOfDate = input.asOfDate ?? new Date().toISOString().slice(0, 10);
    const tokens = tokenizeMatch(ownerName);

    // No tokens would match every owner's receipts
    if (tokens.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Owner name must contain at least one letter or number',
      });
    }

    // The movements ledger carries no pack size, so it comes from the stock
    // record for the same LWIN — the same join the WMS itself relies on.
    const rows = await client<WmsReceiptRow[]>`
      SELECT
        COALESCE(NULLIF(TRIM(m.supplier_sku), ''), m.lwin18) AS code,
        m.product_name AS "productName",
        st.vintage,
        st.case_config AS "caseConfig",
        m.quantity_cases AS "quantityCases",
        (m.quantity_cases * COALESCE(NULLIF(st.case_config, 0), 6))::float8 AS bottles,
        m.performed_at::date::text AS "movedAt",
        m.movement_number AS "movementNumber"
      FROM wms_stock_movements m
      JOIN partners p ON p.id = m.to_owner_id
      LEFT JOIN LATERAL (
        SELECT s.case_config, s.vintage
        FROM wms_stock s
        WHERE s.lwin18 = m.lwin18
        ORDER BY s.received_at DESC NULLS LAST
        LIMIT 1
      ) st ON TRUE
      WHERE m.movement_type = 'receive'
        AND NOT EXISTS (
          SELECT 1 FROM UNNEST(${tokens}::text[]) AS t(tok)
          -- Whole words only: "CRU" must not match "CRURATED"
          WHERE NOT (tok = ANY(REGEXP_SPLIT_TO_ARRAY(UPPER(COALESCE(p.business_name, '')), '[^A-Z0-9]+')))
        )
        AND m.quantity_cases <> 0
      ORDER BY m.performed_at
    `;

    // Stock that landed before WMS receiving went live has no receipt movement
    // to find, so an empty result is an ordinary state rather than a failure —
    // it means the opening position rests entirely on an uploaded baseline.
    // Clearing the feed and reporting zero is the honest outcome; throwing
    // would also abort a Refresh All that has other feeds still to run.
    if (rows.length === 0) {
      await client`
        DELETE FROM tri_imports i
        WHERE i.kind = 'cc_opening' AND i.source_ref = 'wms-receipts'
          AND i.programme_id = ${programmeId}
          AND NOT EXISTS (
            SELECT 1 FROM tri_periods p
            WHERE p.id = i.period_id AND p.status = 'locked'
          )
      `;

      const [baseline] = await client<{ uploads: number; bottles: number }[]>`
        SELECT
          COUNT(DISTINCT i.id)::int AS uploads,
          COALESCE(SUM(l.quantity_bottles), 0)::float8 AS bottles
        FROM tri_imports i
        LEFT JOIN tri_import_lines l ON l.import_id = i.id AND l.status = 'mapped'
        WHERE i.kind = 'cc_opening'
          AND i.status = 'committed'
          AND i.programme_id = ${programmeId}
          AND i.source_ref IS DISTINCT FROM 'wms-receipts'
      `;

      return {
        importId: null,
        asOfDate,
        rowCount: 0,
        mappedRowCount: 0,
        totalBottles: 0,
        receipts: 0,
        missingCaseConfig: 0,
        baselineUploads: baseline?.uploads ?? 0,
        baselineBottles: baseline?.bottles ?? 0,
      };
    }

    const { importId, totals } = await swapFeedImport({
      programmeId,
      replaces: { kind: 'cc_opening', sourceRefs: ['wms-receipts'] },
      create: {
        periodId: null,
        kind: 'cc_opening',
        fileName: `WMS receipts — ${ownerName}`,
        sourceRef: 'wms-receipts',
        aliasSource: 'crurated',
        asOfDate,
        notes:
          'Synced live from the WMS receiving ledger. Each line keeps its own receipt date.',
        uploadedBy: ctx.user.id,
      },
      columns: [
        'raw_code',
        'normalized_code',
        'raw_description',
        'raw_vintage',
        'quantity',
        'unit',
        'case_config',
        'quantity_bottles',
        'doc_ref',
        'doc_date',
        'status',
      ],
      rows: rows.map((row) => ({
        raw_code: row.code,
        normalized_code: normalizeCode(row.code),
        raw_description: row.productName,
        raw_vintage: row.vintage ? String(row.vintage) : null,
        quantity: row.quantityCases,
        unit: 'case',
        case_config: row.caseConfig,
        quantity_bottles: row.bottles,
        doc_ref: row.movementNumber,
        doc_date: row.movedAt,
        status: 'unmapped',
      })),
    });

    return {
      importId,
      asOfDate,
      ...totals,
      receipts: rows.length,
      missingCaseConfig: rows.filter((row) => !row.caseConfig).length,
      baselineUploads: 0,
      baselineBottles: 0,
    };
  });

export default adminSyncReceiptsFromWms;
