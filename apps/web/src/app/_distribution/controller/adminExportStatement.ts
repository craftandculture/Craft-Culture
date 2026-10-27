import { TRPCError } from '@trpc/server';
import * as XLSX from 'xlsx';
import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import buildOwnerStatement from '../data/buildOwnerStatement';

/**
 * The statement as a workbook, in the columns it is argued over in
 *
 * This is what goes to Crurated and to Cru, and what City Drinks invoice
 * against, so the columns are theirs rather than ours: the wine, their code
 * for it, the bottles, what we owe per bottle and in total, what they were
 * billed per bottle and in total, and the invoice it was drawn from. A
 * statement nobody can check against their own records is a statement nobody
 * pays.
 *
 * A wine with no landed cost is exported with an empty Owed and the words in
 * its place. Exporting nil would be a figure they could add up, and the sum
 * would be wrong in our favour.
 *
 * @param ownerId - Whose statement, or null for every partner's summary
 * @param outletId - The distributor
 * @param month - The month, as YYYY-MM
 * @returns The workbook, base64, and the filename to save it under
 */
const adminExportStatement = adminProcedure
  .input(
    z.object({
      ownerId: z.string().uuid().nullable(),
      outletId: z.string().uuid(),
      month: z.string().regex(/^\d{4}-\d{2}$/, 'Expected a YYYY-MM month'),
    }),
  )
  .mutation(async ({ input }) => {
    const [outlet] = await client<{ name: string }[]>`
      SELECT name FROM cons_outlets WHERE id = ${input.outletId}
    `;

    if (!outlet) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'No such outlet' });
    }

    const book = XLSX.utils.book_new();
    const money = (value: number | null) =>
      value === null ? 'no landed cost' : Math.round(value * 100) / 100;

    const owners = input.ownerId
      ? await client<{ id: string; name: string }[]>`
          SELECT id, name FROM cons_owners WHERE id = ${input.ownerId}
        `
      : await client<{ id: string; name: string }[]>`
          SELECT DISTINCT ow.id, ow.name
          FROM cons_arrangements a
          JOIN cons_owners ow ON ow.id = a.owner_id
          WHERE a.outlet_id = ${input.outletId} AND a.is_active
          ORDER BY ow.name
        `;

    const summaryRows: Record<string, string | number>[] = [];

    /*
      A sheet name Excel will accept, unique in this workbook. Excel refuses
      [ ] : * ? / \ in a name (the file will not open or the write throws),
      allows at most 31 characters, and two owners whose names share their
      first 31 characters, or one called "Summary", would collide.
    */
    const used = new Set<string>(['summary']);
    const sheetName = (name: string) => {
      const base =
        name
          .replace(/[[\]:*?\/\\]/g, ' ')
          .replace(/^'+|'+$/g, '')
          .replace(/\s+/g, ' ')
          .trim() || 'Owner';

      for (let n = 1; ; n++) {
        const suffix = n === 1 ? '' : ` (${n})`;
        const candidate = base.slice(0, 31 - suffix.length).trim() + suffix;

        if (!used.has(candidate.toLowerCase())) {
          used.add(candidate.toLowerCase());
          return candidate;
        }
      }
    };

    for (const owner of owners) {
      const statement = await buildOwnerStatement({
        ownerId: owner.id,
        outletId: input.outletId,
        month: input.month,
      });

      if (statement.lines.length === 0) continue;

      const rows = statement.lines.map((line) => ({
        Wine: line.productName,
        'CD code': line.outletCode ?? '',
        LWIN: line.lwin18 ?? '',
        Bottles: line.bottlesSold,
        'Landed cost / btl': money(line.costPerBottle),
        'Amount owed': money(line.dueToOwner),
        'Invoice price / btl':
          line.bottlesSold > 0
            ? Math.round((line.billedToOutlet / line.bottlesSold) * 100) / 100
            : 0,
        'Amount billed': Math.round(line.billedToOutlet * 100) / 100,
        'Source invoice': line.drawnFrom
          .map((draw) => draw.docRef ?? '—')
          .join(', '),
        'Landed cost from': line.costFrom ?? '',
        Currency: line.currency ?? '',
      }));

      const sheet = XLSX.utils.json_to_sheet(rows);

      XLSX.utils.book_append_sheet(book, sheet, sheetName(owner.name));

      summaryRows.push({
        Partner: owner.name,
        Wines: statement.summary?.wines ?? 0,
        Bottles: statement.summary?.bottles ?? 0,
        'We owe them': Math.round((statement.summary?.dueToOwner ?? 0) * 100) / 100,
        'City Drinks owe us':
          Math.round((statement.summary?.billedToOutlet ?? 0) * 100) / 100,
        Margin: Math.round((statement.summary?.margin ?? 0) * 100) / 100,
        'Wines with no landed cost': statement.summary?.withoutCost ?? 0,
      });
    }

    if (summaryRows.length === 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Nothing sold at ${outlet.name} in ${input.month}, so there is no statement to export.`,
      });
    }

    /*
      The total is a row on the sheet rather than a formula: the file is read
      by people who did not build it, in software we do not choose, and a
      formula that fails to recalculate reads as a number.
    */
    summaryRows.push({
      Partner: 'TOTAL — invoice City Drinks',
      Wines: summaryRows.reduce((sum, row) => sum + Number(row.Wines), 0),
      Bottles: summaryRows.reduce((sum, row) => sum + Number(row.Bottles), 0),
      'We owe them':
        Math.round(
          summaryRows.reduce((sum, row) => sum + Number(row['We owe them']), 0) *
            100,
        ) / 100,
      'City Drinks owe us':
        Math.round(
          summaryRows.reduce(
            (sum, row) => sum + Number(row['City Drinks owe us']),
            0,
          ) * 100,
        ) / 100,
      Margin:
        Math.round(
          summaryRows.reduce((sum, row) => sum + Number(row.Margin), 0) * 100,
        ) / 100,
      'Wines with no landed cost': summaryRows.reduce(
        (sum, row) => sum + Number(row['Wines with no landed cost']),
        0,
      ),
    });

    const summarySheet = XLSX.utils.json_to_sheet(summaryRows);

    book.SheetNames.unshift('Summary');
    book.Sheets.Summary = summarySheet;

    const base64 = XLSX.write(book, { type: 'base64', bookType: 'xlsx' });
    const who = input.ownerId ? (owners[0]?.name ?? 'owner') : 'all partners';

    return {
      base64,
      filename: `${outlet.name} — ${who} — ${input.month}.xlsx`.replace(
        /[/\\?%*:|"<>]/g,
        '-',
      ),
    };
  });

export default adminExportStatement;
