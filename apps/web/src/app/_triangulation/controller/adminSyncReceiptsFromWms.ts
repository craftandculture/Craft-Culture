import { TRPCError } from '@trpc/server';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import insertRows from '../data/insertRows';
import mapImportLines from '../data/mapImportLines';
import { syncCountFromWmsSchema } from '../schemas/triangulationSchemas';
import normalizeCode from '../utils/normalizeCode';

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
    const { ownerName } = input;
    const asOfDate = input.asOfDate ?? new Date().toISOString().slice(0, 10);

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
        AND p.business_name ILIKE ${ownerName}
        AND m.quantity_cases <> 0
      ORDER BY m.performed_at
    `;

    if (rows.length === 0) {
      const owners = await client<{ businessName: string }[]>`
        SELECT DISTINCT p.business_name AS "businessName"
        FROM wms_stock_movements m
        JOIN partners p ON p.id = m.to_owner_id
        WHERE m.movement_type = 'receive'
        ORDER BY p.business_name
      `;

      throw new TRPCError({
        code: 'NOT_FOUND',
        message:
          `No WMS receipts found for owner "${ownerName}".` +
          (owners.length > 0
            ? ` Owners with receipts: ${owners.map((row) => row.businessName).join(', ')}.`
            : ''),
      });
    }

    await client`
      DELETE FROM tri_imports
      WHERE kind = 'cc_opening' AND source_ref = 'wms-receipts'
    `;

    const [created] = await client<{ id: string }[]>`
      INSERT INTO tri_imports (
        period_id, kind, status, file_name, source_ref, alias_source,
        as_of_date, notes, uploaded_by, committed_at
      )
      VALUES (
        NULL, 'cc_opening', 'committed',
        ${`WMS receipts — ${ownerName}`}, 'wms-receipts', 'crurated',
        ${asOfDate},
        ${'Synced live from the WMS receiving ledger. Each line keeps its own receipt date.'},
        ${ctx.user.id}, NOW()
      )
      RETURNING id
    `;

    const importId = created?.id;

    if (!importId) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create the receipts feed',
      });
    }

    await insertRows(
      'tri_import_lines',
      [
        'import_id',
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
      rows.map((row) => ({
        import_id: importId,
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
    );

    const totals = await mapImportLines(importId, 'crurated');

    return {
      importId,
      asOfDate,
      ...totals,
      receipts: rows.length,
      missingCaseConfig: rows.filter((row) => !row.caseConfig).length,
    };
  });

export default adminSyncReceiptsFromWms;
