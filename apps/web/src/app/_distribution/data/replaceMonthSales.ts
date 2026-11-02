import { client } from '@/database/client';

import attributeOutletSales from './attributeOutletSales';
import type { OutletSaleLine } from './attributeOutletSales';
import tableReady from '../utils/tableReady';
import unmatchedReady from '../utils/unmatchedReady';


/**
 * Attribute a month of an outlet's sales and put it in the ledger
 *
 * Replaces the month rather than appending, so a corrected sheet re-sent, or a
 * line confirmed from the queue, corrects rather than doubles. The sold rows
 * and the unanswered lines are written together, so between them they always
 * account for every bottle on the sheet.
 *
 * @param input - The outlet, month (YYYY-MM), its lines, and the label to file
 *   the sold rows under
 * @returns What was attributed and what is still waiting
 */
const replaceMonthSales = async (input: {
  outletId: string;
  month: string;
  lines: OutletSaleLine[];
  docRef: string;
}) => {
  const { sold, unmatched } = await attributeOutletSales(input);

  const rows = sold.map((row) => ({
    arrangement_id: row.arrangementId,
    kind: 'sold',
    lwin18: row.lwin18,
    product_name: row.productName,
    outlet_code: row.outletCode,
    bottles: row.bottles,
    source_qty: row.bottles,
    source_unit: 'bottle',
    pack: 1,
    pack_assumed: false,
    owner_reason: row.short
      ? `${row.via}; sold past every invoice line`
      : row.via,
    doc_ref: input.docRef,
    doc_date: `${input.month}-01`,
    source: 'outlet-sales-report',
  }));

  const keepsUnmatched = await unmatchedReady();
  const withSuggestions = await tableReady('cons_invoice_types');

  // The month is replaced in one transaction: a failure part-way keeps the
  // previous import rather than leaving the month empty
  await client.begin(async (sql) => {
    await sql`
      DELETE FROM cons_movements m
      USING cons_arrangements a
      WHERE m.arrangement_id = a.id
        AND a.outlet_id = ${input.outletId}
        AND m.kind = 'sold'
        AND m.source = 'outlet-sales-report'
        AND TO_CHAR(m.doc_date, 'YYYY-MM') = ${input.month}
    `;

    if (rows.length > 0) {
      await sql`INSERT INTO cons_movements ${sql(rows)}`;
    }

    if (!keepsUnmatched) return;

    await sql`
      DELETE FROM cons_import_unmatched
      WHERE outlet_id = ${input.outletId} AND month = ${input.month}
    `;

    if (unmatched.length > 0) {
      await sql`INSERT INTO cons_import_unmatched ${sql(
        unmatched.map((line) => ({
          outlet_id: input.outletId,
          month: input.month,
          outlet_code: line.outletCode,
          product_name: line.productName,
          bottles: line.bottles,
          reason: line.reason,
          ...(withSuggestions
            ? {
                suggested_owner_id: line.suggestedOwnerId,
                suggested_lwin18: line.suggestedLwin18,
                suggested_name: line.suggestedName,
                suggested_why: line.suggestedWhy,
                candidate_owner_ids: line.candidateOwnerIds,
              }
            : {}),
        })),
      )}`;
    }
  });

  return {
    lines: rows.length,
    bottles: rows.reduce((sum, row) => sum + row.bottles, 0),
    shortBottles: sold
      .filter((row) => row.short)
      .reduce((sum, row) => sum + row.bottles, 0),
    unattributedBottles: unmatched.reduce((sum, line) => sum + line.bottles, 0),
    unattributed: unmatched
      .slice(0, 30)
      .map(
        (line) =>
          `${line.outletCode} · ${line.productName} — ${line.bottles} btl · ${line.reason}`,
      ),
  };
};

export default replaceMonthSales;
