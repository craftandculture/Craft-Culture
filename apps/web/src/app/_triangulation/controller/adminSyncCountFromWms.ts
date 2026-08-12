import { TRPCError } from '@trpc/server';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import insertRows from '../data/insertRows';
import mapImportLines from '../data/mapImportLines';
import { syncCountFromWmsSchema } from '../schemas/triangulationSchemas';
import normalizeCode from '../utils/normalizeCode';

interface WmsCountRow {
  code: string | null;
  productName: string;
  vintage: number | null;
  caseConfig: number | null;
  bottles: number;
  missingWCode: boolean;
  missingCaseConfig: boolean;
}

/**
 * Take the C&C on-hand snapshot straight from the WMS instead of a spreadsheet
 *
 * `wms_stock` is the system of record for what C&C physically holds, so
 * exporting it to Excel only to upload it again adds a step and a chance to
 * pick the wrong column. This reads it directly and files it as a `cc_count`
 * import, the same shape a manual upload would produce.
 *
 * It is more precise than an export, too: bottles are computed as sealed cases
 * times pack size plus loose bottles from split cases, so a cracked case is
 * counted properly rather than rounded to a whole one.
 *
 * Re-running for a date replaces that day's synced snapshot rather than adding
 * to it — the reconciliation sums every line sharing the latest count date, so
 * appending would silently double the counted position.
 */
const adminSyncCountFromWms = adminProcedure
  .input(syncCountFromWmsSchema)
  .mutation(async ({ input, ctx }) => {
    const { ownerName, periodId } = input;
    const asOfDate = input.asOfDate ?? new Date().toISOString().slice(0, 10);

    if (periodId) {
      const [period] = await client<{ status: string }[]>`
        SELECT status FROM tri_periods WHERE id = ${periodId} LIMIT 1
      `;

      if (period?.status === 'locked') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This period is locked. Reopen it before syncing.',
        });
      }
    }

    // Group by W code, falling back to LWIN so stock without a supplier SKU
    // still appears — it lands in the mapping queue rather than vanishing.
    const rows = await client<WmsCountRow[]>`
      SELECT
        COALESCE(NULLIF(TRIM(s.supplier_sku), ''), s.lwin18) AS code,
        MIN(s.product_name) AS "productName",
        MIN(s.vintage) AS vintage,
        MAX(NULLIF(s.case_config, 0)) AS "caseConfig",
        SUM(
          s.quantity_cases * COALESCE(NULLIF(s.case_config, 0), 6)
          + COALESCE(s.open_bottles, 0)
        )::float8 AS bottles,
        BOOL_OR(NULLIF(TRIM(s.supplier_sku), '') IS NULL) AS "missingWCode",
        BOOL_OR(NULLIF(s.case_config, 0) IS NULL) AS "missingCaseConfig"
      FROM wms_stock s
      WHERE s.owner_name ILIKE ${ownerName}
      GROUP BY COALESCE(NULLIF(TRIM(s.supplier_sku), ''), s.lwin18)
      HAVING SUM(
        s.quantity_cases * COALESCE(NULLIF(s.case_config, 0), 6)
        + COALESCE(s.open_bottles, 0)
      ) > 0
    `;

    if (rows.length === 0) {
      // The owner name has to match what the WMS stores, so say what it holds
      // rather than leaving them guessing at the spelling.
      const owners = await client<{ ownerName: string }[]>`
        SELECT DISTINCT owner_name AS "ownerName"
        FROM wms_stock
        WHERE owner_name IS NOT NULL
        ORDER BY owner_name
      `;

      throw new TRPCError({
        code: 'NOT_FOUND',
        message:
          `No stock in the WMS for owner "${ownerName}".` +
          (owners.length > 0
            ? ` Owners with stock: ${owners.map((row) => row.ownerName).join(', ')}.`
            : ''),
      });
    }

    // A manual count filed for the same date would be summed alongside this
    // one, so flag it rather than quietly double the position.
    const [manual] = await client<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM tri_imports
      WHERE kind = 'cc_count'
        AND as_of_date = ${asOfDate}
        AND (source_ref IS DISTINCT FROM 'wms-sync')
    `;

    await client`
      DELETE FROM tri_imports
      WHERE kind = 'cc_count'
        AND as_of_date = ${asOfDate}
        AND source_ref = 'wms-sync'
    `;

    const [created] = await client<{ id: string }[]>`
      INSERT INTO tri_imports (
        period_id, kind, status, file_name, source_ref, alias_source,
        as_of_date, notes, uploaded_by, committed_at
      )
      VALUES (
        ${periodId ?? null}, 'cc_count', 'committed',
        ${`WMS stock — ${ownerName}`}, 'wms-sync', 'crurated',
        ${asOfDate}, ${'Synced live from wms_stock. Bottles = sealed cases x pack size + loose bottles.'},
        ${ctx.user.id}, NOW()
      )
      RETURNING id
    `;

    const importId = created?.id;

    if (!importId) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create the WMS snapshot',
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
        'status',
      ],
      rows.map((row) => ({
        import_id: importId,
        raw_code: row.code,
        normalized_code: normalizeCode(row.code),
        raw_description: row.productName,
        raw_vintage: row.vintage ? String(row.vintage) : null,
        // Bottles are already exact here, so the line is denominated in them
        // and needs no pack-size conversion downstream.
        quantity: row.bottles,
        unit: 'bottle',
        case_config: row.caseConfig,
        quantity_bottles: row.bottles,
        status: 'unmapped',
      })),
    );

    const totals = await mapImportLines(importId, 'crurated');

    return {
      importId,
      asOfDate,
      ...totals,
      missingWCodes: rows.filter((row) => row.missingWCode).length,
      missingCaseConfig: rows.filter((row) => row.missingCaseConfig).length,
      manualCountsSameDate: manual?.count ?? 0,
    };
  });

export default adminSyncCountFromWms;
