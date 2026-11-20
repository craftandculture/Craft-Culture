import { TRPCError } from '@trpc/server';
import * as XLSX from 'xlsx';
import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import buildMonthSettlement from '../data/buildMonthSettlement';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * The month's settlement as one workbook: CD statement, Owner payouts, Margin
 *
 * Laid out as Sophie's payment-run tab is, because City Drinks already check
 * that layout: their code, the wine, bottles, our invoice, price per bottle,
 * any dated cut and the amount; the adjustments; the total due; then a
 * separate "Please check: already billed" list and the oversold notes. Totals
 * are rows rather than formulas, so the file reads the same in any software.
 *
 * Refused while the month has anything outstanding (unmatched codes, a wine
 * with no cost, bottles that do not add up), unless asked for as a draft,
 * which is marked as one on every tab.
 *
 * @param outletId - The outlet
 * @param month - YYYY-MM
 * @param draft - Export even with blockers, marked DRAFT
 * @returns The workbook, base64, and its filename
 */
const adminExportSettlement = adminProcedure
  .input(
    z.object({
      outletId: z.string().uuid(),
      month: z.string().regex(/^\d{4}-\d{2}$/, 'Expected a YYYY-MM month'),
      draft: z.boolean().default(false),
    }),
  )
  .mutation(async ({ input }) => {
    const [outlet] = await client<{ name: string }[]>`
      SELECT name FROM cons_outlets WHERE id = ${input.outletId}
    `;

    if (!outlet) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'No such outlet' });
    }

    const settlement = await buildMonthSettlement(input);

    if (settlement.blockers.length > 0 && !input.draft) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `Not ready to export: ${settlement.blockers.join('; ')}.`,
      });
    }

    const [year, monthNumber] = input.month.split('-');
    const monthName = `${MONTHS[Number(monthNumber) - 1]} ${year}`;
    const draftMark = settlement.blockers.length > 0 ? 'DRAFT, not final. ' : '';
    const money = (value: number) => Math.round(value * 100) / 100;

    /* CD statement */
    const cd: (string | number | null)[][] = [
      [`${draftMark}${outlet.name}: ${monthName} consignment sales`],
      [
        'Price = our invoice price per bottle (USD), matched to the invoice each bottle came from, oldest first.',
      ],
      [],
      ['CD code', 'Wine', 'Bottles', 'Invoice', 'Price / btl ($)', 'Price cut', 'Amount ($)'],
      ...settlement.cdLines.map((line) => [
        line.outletCode,
        line.productName,
        line.bottles,
        line.docRef,
        line.pricePerBottle,
        line.priceCutPct ? `${line.priceCutPct}% applied` : null,
        line.amount,
      ]),
      [
        `${MONTHS[Number(monthNumber) - 1]} sales`,
        null,
        settlement.check.billedBottles,
        null,
        null,
        null,
        settlement.totals.salesDue,
      ],
      ...settlement.adjustments.map((row) => [
        'Adjustment',
        row.description,
        null,
        null,
        null,
        null,
        money(row.amount),
      ]),
      [`TOTAL DUE FOR ${MONTHS[Number(monthNumber) - 1]?.toUpperCase()}`, null, null, null, null, null, settlement.totals.totalDue],
    ];

    if (settlement.alreadyBilled.length > 0) {
      cd.push(
        [],
        [
          'PLEASE CHECK: we think these bottles have already been billed to you on the invoices below, so they are not charged again here',
        ],
        ['CD code', 'Wine', 'Bottles', 'Our invoice', 'Price / btl ($)', null, 'Value ($)'],
        ...settlement.alreadyBilled.map((row) => [
          row.outletCode,
          row.productName,
          row.bottles,
          row.docRef,
          row.pricePerBottle,
          null,
          row.value,
        ]),
        ['TOTAL (not charged here)', null, settlement.check.alreadyBilledBottles, null, null, null, settlement.totals.alreadyBilledValue],
      );
    }

    const oversold = settlement.exceptions.filter((row) => row.kind === 'oversold');

    if (oversold.length > 0) {
      cd.push(
        [],
        ['More sold than we have invoiced, please check where these bottles came from:'],
        ...oversold.map((row) => [row.outletCode, row.productName, row.bottles, null, null, null, null]),
      );
    }

    /* Owner payouts */
    const payouts: (string | number | null)[][] = [
      [`${draftMark}What C&C owes each owner: ${monthName}`],
      [
        'Agreed price per bottle = Pricing Manager import + logistics + override on the owner’s own lot, unless the owner has an agreed basis.',
      ],
      [],
      ['Owner', 'Wine', 'CD code', 'Bottles', 'Price / btl ($)', 'Amount owed ($)', 'Price from'],
    ];

    for (const owner of settlement.payouts) {
      for (const line of owner.lines) {
        payouts.push([
          owner.ownerName,
          line.productName,
          line.outletCode,
          line.bottles,
          line.costPerBottle,
          line.amount ?? 'no cost',
          line.costFrom,
        ]);
      }

      if (owner.adjustments) {
        payouts.push([owner.ownerName, 'Adjustment', null, null, null, owner.adjustments, null]);
      }

      payouts.push([`${owner.ownerName} total`, null, null, owner.bottles, null, owner.dueToOwner, null], []);
    }

    payouts.push(['TOTAL OWED TO OWNERS', null, null, null, null, settlement.totals.dueToOwners, null]);

    /* Margin */
    const margin: (string | number | null)[][] = [
      [`${draftMark}C&C margin: ${monthName}`],
      [],
      ['Owner', 'Wine', 'Bottles', 'CD price ($)', 'Owner price ($)', 'Margin ($)'],
    ];

    for (const owner of settlement.payouts) {
      for (const line of owner.lines) {
        margin.push([
          owner.ownerName,
          line.productName,
          line.bottles,
          line.billed,
          line.amount,
          line.amount === null ? null : money(line.billed - line.amount),
        ]);
      }
    }

    margin.push(
      ['TOTAL', null, null, settlement.totals.salesDue, settlement.totals.dueToOwners, settlement.totals.margin],
    );

    const book = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(cd), 'CD statement');
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(payouts), 'Owner payouts');
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(margin), 'Margin');

    if (settlement.exceptions.length > 0) {
      XLSX.utils.book_append_sheet(
        book,
        XLSX.utils.aoa_to_sheet([
          ['Type', 'CD code', 'Wine', 'Bottles', 'Detail'],
          ...settlement.exceptions.map((row) => [
            row.kind,
            row.outletCode,
            row.productName,
            row.bottles,
            row.detail,
          ]),
        ]),
        'Exceptions',
      );
    }

    return {
      base64: XLSX.write(book, { type: 'base64', bookType: 'xlsx' }) as string,
      filename: `${outlet.name} settlement ${input.month}${draftMark ? ' DRAFT' : ''}.xlsx`.replace(
        /[/\\?%*:|"<>]/g,
        '-',
      ),
    };
  });

export default adminExportSettlement;
