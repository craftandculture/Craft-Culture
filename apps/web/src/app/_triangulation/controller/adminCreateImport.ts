import { TRPCError } from '@trpc/server';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import insertRows from '../data/insertRows';
import mapImportLines from '../data/mapImportLines';
import { createImportSchema } from '../schemas/triangulationSchemas';
import normalizeCode from '../utils/normalizeCode';
import toBottles from '../utils/toBottles';

/**
 * Store one uploaded input file as a draft import
 *
 * Rows arrive already parsed and column-mapped by the browser, so this only
 * normalises them (codes uppercased, quantities converted to bottles) and runs
 * SKU matching. The import lands as `draft` — nothing reaches the
 * reconciliation until it is committed, which gives a chance to resolve any
 * unmapped codes first.
 */
const adminCreateImport = adminProcedure
  .input(createImportSchema)
  .mutation(async ({ input, ctx }) => {
    const { periodId, kind, fileName, sourceRef, asOfDate, notes, aliasSource, lines } =
      input;

    if (periodId) {
      const [period] = await client<{ status: string }[]>`
        SELECT status FROM tri_periods WHERE id = ${periodId} LIMIT 1
      `;

      if (!period) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Period not found' });
      }

      if (period.status === 'locked') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This period is locked. Reopen it before adding imports.',
        });
      }
    }

    const [created] = await client<{ id: string }[]>`
      INSERT INTO tri_imports (
        period_id, kind, file_name, source_ref, alias_source,
        as_of_date, notes, uploaded_by
      )
      VALUES (
        ${periodId ?? null}, ${kind}, ${fileName ?? null}, ${sourceRef ?? null},
        ${aliasSource}, ${asOfDate}, ${notes ?? null}, ${ctx.user.id}
      )
      RETURNING id
    `;

    const importId = created?.id;

    if (!importId) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create import',
      });
    }

    const rows = lines.map((line) => ({
      import_id: importId,
      raw_code: line.rawCode ?? null,
      normalized_code: normalizeCode(line.rawCode),
      raw_description: line.rawDescription ?? null,
      raw_vintage: line.rawVintage ?? null,
      quantity: line.quantity,
      unit: line.unit,
      case_config: line.caseConfig ?? null,
      quantity_bottles: toBottles(line.quantity, line.unit, line.caseConfig),
      unit_price: line.unitPrice ?? null,
      currency: line.currency ?? null,
      doc_ref: line.docRef ?? null,
      doc_date: line.docDate ?? null,
      status: 'unmapped',
      raw: line.raw ?? null,
    }));

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
        'unit_price',
        'currency',
        'doc_ref',
        'doc_date',
        'status',
        'raw',
      ],
      rows,
      { jsonbColumns: ['raw'] },
    );

    const totals = await mapImportLines(importId, aliasSource);

    return { importId, ...totals };
  });

export default adminCreateImport;
