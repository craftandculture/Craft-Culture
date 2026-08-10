import * as XLSX from 'xlsx';

import type { TriangulationRow } from '../controller/adminGetTriangulation';

/**
 * Download the current reconciliation as an Excel workbook
 *
 * The monthly review is circulated outside the platform — to City Drinks and
 * to the owner — so the on-screen table needs to leave as a file that carries
 * the same columns and the same cut-off dates.
 *
 * @param rows - The reconciliation rows currently on screen
 * @param meta - Period label and count dates, written into the file name
 */
const exportTriangulationToExcel = (
  rows: TriangulationRow[],
  meta: { periodLabel: string; ccCountDate: string | null; cdCountDate: string | null },
) => {
  const sheetRows = rows.map((row) => ({
    'W code': row.wCode,
    'CD code(s)': row.cdCodes ?? '',
    Product: row.productName,
    Producer: row.producer ?? '',
    Vintage: row.vintage ?? '',
    'Bottles/case': row.caseConfig,
    'Received into C&C': row.ccReceived,
    'Invoiced to City Drinks': row.ccSoldToCd,
    'C&C on hand (calc)': row.ccOnHandCalc,
    [`C&C calc at ${meta.ccCountDate ?? 'count'}`]: row.ccOnHandCalcAtCount ?? '',
    'C&C counted': row.ccCounted ?? '',
    'C&C variance': row.ccVariance ?? '',
    'CD received': row.cdReceived,
    'CD sold to consumers': row.cdSold,
    'CD on hand (calc)': row.cdOnHandCalc,
    [`CD calc at ${meta.cdCountDate ?? 'count'}`]: row.cdOnHandCalcAtCount ?? '',
    'CD declared': row.cdDeclared ?? '',
    'CD variance': row.cdVariance ?? '',
    Flag: row.hasNegative ? 'NEGATIVE POSITION' : '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(sheetRows);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Triangulation');

  const safeLabel = meta.periodLabel.replace(/[^A-Za-z0-9-]+/g, '-');

  XLSX.writeFile(workbook, `stock-triangulation-${safeLabel}.xlsx`);
};

export default exportTriangulationToExcel;
