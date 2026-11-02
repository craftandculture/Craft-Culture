import { client } from '@/database/client';

import replaceMonthSales from './replaceMonthSales';
import unmatchedReady from '../utils/unmatchedReady';


/**
 * Attribute a month again from what is already stored
 *
 * The month's sheet is not kept, but every bottle on it is: attributed ones as
 * sold rows, the rest in the queue. Put back together per code, that is the
 * sheet again — so a confirmed line, a newly uploaded Codes tab or a corrected
 * invoice type takes effect without anyone finding and re-uploading the file.
 *
 * @param input - The outlet and month (YYYY-MM)
 * @returns What was attributed and what is still waiting
 */
const reattributeMonth = async (input: { outletId: string; month: string }) => {
  const sold = await client<
    { outletCode: string; productName: string; bottles: number; docRef: string | null }[]
  >`
    SELECT m.outlet_code AS "outletCode", MIN(m.product_name) AS "productName",
           SUM(m.bottles)::float8 AS bottles, MIN(m.doc_ref) AS "docRef"
    FROM cons_movements m
    JOIN cons_arrangements a ON a.id = m.arrangement_id
    WHERE a.outlet_id = ${input.outletId}
      AND m.kind = 'sold'
      AND m.source = 'outlet-sales-report'
      AND TO_CHAR(m.doc_date, 'YYYY-MM') = ${input.month}
      AND m.outlet_code IS NOT NULL
    GROUP BY m.outlet_code
  `;

  const waiting = (await unmatchedReady())
    ? await client<{ outletCode: string; productName: string; bottles: number }[]>`
        SELECT outlet_code AS "outletCode",
               COALESCE(MIN(product_name), '') AS "productName",
               SUM(bottles)::float8 AS bottles
        FROM cons_import_unmatched
        WHERE outlet_id = ${input.outletId} AND month = ${input.month}
          AND outlet_code IS NOT NULL
        GROUP BY outlet_code
      `
    : [];

  const byCode = new Map<string, { outletCode: string; productName: string; bottles: number }>();

  for (const line of [...sold, ...waiting]) {
    const existing = byCode.get(line.outletCode);

    byCode.set(line.outletCode, {
      outletCode: line.outletCode,
      productName: existing?.productName || line.productName,
      bottles: (existing?.bottles ?? 0) + line.bottles,
    });
  }

  if (byCode.size === 0) {
    return null;
  }

  return replaceMonthSales({
    outletId: input.outletId,
    month: input.month,
    lines: [...byCode.values()],
    docRef: sold[0]?.docRef ?? `${input.month} sales`,
  });
};

export default reattributeMonth;
