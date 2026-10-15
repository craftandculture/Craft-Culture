import ExcelJS from 'exceljs';

import canSendReorderLine from './canSendReorderLine';
import type { ReorderLine } from '../data/getOutletReorderList';

const STATUS_LABEL = { oos: 'Out of stock', low: 'Low', oneoff: 'One-off' } as const;

/**
 * The Reorder watch as a spreadsheet, for preparing orders and owner follow-up
 *
 * One sheet per owner, so each consignor's list can be sent on as it is, with
 * To send and To source as a column to filter on. Quantities are bottles,
 * with the case size alongside; partial fills and vintages needing City
 * Drinks' agreement are flagged in their own columns.
 *
 * @param outletName - The distributor
 * @param lines - Already filtered to the owner and section asked for
 * @returns The workbook as a buffer
 */
const buildReorderWorkbook = async (outletName: string, lines: ReorderLine[]) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Craft & Culture';

  const owners = [...new Set(lines.map((l) => l.owner))].sort((a, b) =>
    a === 'C&C' ? -1 : b === 'C&C' ? 1 : a.localeCompare(b),
  );

  for (const owner of owners.length ? owners : ['Nothing to list']) {
    const sheet = workbook.addWorksheet(owner.replace(/[\\/?*[\]:]/g, '').slice(0, 31));
    sheet.columns = [
      { header: 'Section', key: 'section', width: 10 },
      { header: 'Status', key: 'status', width: 13 },
      { header: 'Wine', key: 'wine', width: 52 },
      { header: 'LWIN', key: 'lwin', width: 22 },
      { header: 'Owner', key: 'owner', width: 14 },
      { header: `Sold 30d`, key: 'sold30', width: 9 },
      { header: 'Sold 90d', key: 'sold90', width: 9 },
      { header: `On shelf at ${outletName}`, key: 'held', width: 14 },
      { header: 'Days left', key: 'days', width: 9 },
      { header: 'In transit to them', key: 'transit', width: 12 },
      { header: 'Send (bottles)', key: 'send', width: 12 },
      { header: 'Send as', key: 'sendAs', width: 12 },
      { header: 'Bottles per case', key: 'pack', width: 10 },
      { header: 'Ours at C&C', key: 'stock', width: 11 },
      { header: 'Consignor at C&C', key: 'consignor', width: 14 },
      { header: 'Inbound', key: 'inbound', width: 9 },
      { header: 'Inbound ETA', key: 'eta', width: 12 },
      { header: 'Partial', key: 'partial', width: 16 },
      { header: 'Other vintage (confirm with distributor)', key: 'alt', width: 34 },
    ];

    lines
      .filter((l) => l.owner === owner)
      .forEach((line) => {
        const send = canSendReorderLine(line);
        sheet.addRow({
          section: send ? 'To send' : 'To source',
          status: STATUS_LABEL[line.status],
          wine: line.wine,
          lwin: line.lwin18,
          owner: line.owner,
          sold30: line.sold30,
          sold90: line.sold90,
          held: line.held,
          days: line.status === 'low' ? line.daysCover : null,
          transit: line.inTransit || null,
          send: send ? line.suggestBottles : null,
          sendAs: send
            ? line.unit === 'case'
              ? `${line.suggestCases} case${line.suggestCases === 1 ? '' : 's'}`
              : `${line.suggestBottles} bottle${line.suggestBottles === 1 ? '' : 's'}`
            : null,
          pack: line.pack,
          stock: line.supply?.stock || null,
          consignor: line.supply?.consignor
            ? `${line.supply.consignor} (${line.supply.consignorName ?? 'consignor'})`
            : null,
          inbound: line.supply?.inbound || null,
          eta: line.supply?.inboundEta ? new Date(line.supply.inboundEta) : null,
          partial:
            send && line.available > 0 && line.available < line.suggestBottles
              ? `Only ${line.available} of ${line.suggestBottles}`
              : null,
          alt: line.available === 0 && line.alternatives.length
            ? line.alternatives
                .map((a) => `${a.vintage} (${a.stock ? `${a.stock} btl` : 'inbound'})`)
                .join(', ')
            : null,
        });
      });

    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
    sheet.getColumn('eta').numFmt = 'dd mmm yyyy';
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
};

export default buildReorderWorkbook;
