import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';
import { createBill } from '@/lib/zoho/bills';
import { createInvoice, listInvoices } from '@/lib/zoho/invoices';
import type { ZohoLineItem } from '@/lib/zoho/types';
import logger from '@/utils/logger';

import buildMonthSettlement from '../data/buildMonthSettlement';
import buildOutrightSales from '../data/buildOutrightSales';
import assertMonthOpen from '../utils/assertMonthOpen';
import tableReady from '../utils/tableReady';

/** The reference every settlement document carries, so the Zoho sync can tell them from stock invoices */
export const settlementReference = (month: string) => `SETTLEMENT ${month}`;

const squash = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Approve a month with an outlet: raise the Zoho documents and lock it
 *
 * Step four of Sophie's month end. The month must be clear first (no
 * unmatched codes, every wine costed, every bottle accounted for). It then
 * raises one draft invoice to the outlet, a line per billed wine and a line
 * per adjustment, and one bill per owner, a line per wine at their agreed
 * price, and freezes the figures it was approved on. Nothing is sent: the
 * invoice stays a draft for Sophie to check and send from Zoho.
 *
 * The month is locked before Zoho is called, so a second click cannot raise a
 * second set. If the invoice cannot be raised the lock is released and
 * nothing is left half done; a bill that fails is reported and the rest
 * stand, since each bill is independent.
 *
 * @param outletId - The outlet
 * @param month - YYYY-MM
 * @returns The invoice raised and how many bills
 */
const adminApproveMonth = adminProcedure
  .input(
    z.object({
      outletId: z.string().uuid(),
      month: z.string().regex(/^\d{4}-\d{2}$/, 'Expected a YYYY-MM month'),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    if (!(await tableReady('cons_month_closes'))) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Month approval is not available on this database yet.',
      });
    }

    await assertMonthOpen(input.outletId, input.month);

    const [settlement, outright] = await Promise.all([
      buildMonthSettlement(input),
      buildOutrightSales(input.month),
    ]);

    const outrightBlockers = [
      ...(outright.lines.some((line) => line.needsConfirm)
        ? [`${outright.lines.filter((line) => line.needsConfirm).length} outright lines whose owner needs confirming`]
        : []),
      ...(outright.lines.some((line) => line.owed === null && line.ownerPartnerId)
        ? [`${outright.lines.filter((line) => line.owed === null && line.ownerPartnerId).length} outright lines with no cost in the Pricing Manager`]
        : []),
    ];
    const blockers = [...settlement.blockers, ...outrightBlockers];

    if (blockers.length > 0) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `Clear these first: ${blockers.join('; ')}.`,
      });
    }

    const [outlet] = await client<{ name: string; zohoCustomerMatch: string | null }[]>`
      SELECT name, zoho_customer_match AS "zohoCustomerMatch"
      FROM cons_outlets WHERE id = ${input.outletId}
    `;

    if (!outlet?.zohoCustomerMatch) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'This outlet is not linked to a Zoho customer.',
      });
    }

    /* The outlet's Zoho customer, from the invoices already raised to it */
    const wanted = squash(outlet.zohoCustomerMatch);
    let customerId: string | null = null;

    for (let page = 1; page <= 5 && !customerId; page += 1) {
      const result = await listInvoices({ page, perPage: 200 });
      const hit = result.invoices.find((invoice) =>
        squash(invoice.customer_name ?? '').includes(wanted),
      );

      customerId = hit?.customer_id ?? null;

      if (!result.pageContext?.has_more_page) break;
    }

    if (!customerId) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `No Zoho customer found for ${outlet.name}.`,
      });
    }

    const reference = settlementReference(input.month);

    /* Locked first, so a second click cannot raise a second set */
    const [locked] = await client<{ month: string }[]>`
      INSERT INTO cons_month_closes (outlet_id, month, figures, approved_by)
      VALUES (
        ${input.outletId}, ${input.month},
        ${client.json(JSON.parse(JSON.stringify({ totals: settlement.totals, check: settlement.check, cdLines: settlement.cdLines, alreadyBilled: settlement.alreadyBilled, adjustments: settlement.adjustments, payouts: settlement.payouts, outright: outright.lines })))},
        ${ctx.user.id}
      )
      ON CONFLICT (outlet_id, month) DO NOTHING
      RETURNING month
    `;

    if (!locked) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `${input.month} has already been approved.`,
      });
    }

    const invoiceLines: ZohoLineItem[] = [
      ...settlement.cdLines.map((line) => ({
        name: line.productName.slice(0, 100),
        description: [
          line.outletCode,
          line.docRef ? `from ${line.docRef}` : null,
          line.priceCutPct ? `${line.priceCutPct}% price cut applied` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        quantity: line.bottles,
        rate: line.pricePerBottle,
      })),
      ...settlement.adjustments.map((row) => ({
        name: 'Adjustment',
        description: row.description.slice(0, 2000),
        quantity: 1,
        rate: Math.round(row.amount * 100) / 100,
      })),
    ];

    let invoice: { invoice_id: string; invoice_number: string };

    try {
      invoice = await createInvoice({
        customer_id: customerId,
        reference_number: reference,
        date: new Date().toISOString().slice(0, 10),
        line_items: invoiceLines,
        notes: `Consignment sales for ${input.month}, from your monthly consignment report. Bottles already billed on earlier invoices are not charged again.`,
      });
    } catch (error) {
      await client`
        DELETE FROM cons_month_closes
        WHERE outlet_id = ${input.outletId} AND month = ${input.month}
      `;

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Zoho refused the invoice, so the month was not approved: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    const bills: { owner: string; billId?: string; billNumber?: string; problem?: string }[] = [];

    /* One bill per partner, covering consignment and outright sales together */
    const billOwners = new Map<
      string,
      { ownerName: string; partnerId: string; lines: ZohoLineItem[]; total: number }
    >();

    for (const owner of settlement.payouts) {
      if (!owner.partnerId) continue;

      const entry = billOwners.get(owner.partnerId) ?? {
        ownerName: owner.ownerName,
        partnerId: owner.partnerId,
        lines: [],
        total: 0,
      };

      entry.lines.push(
        ...owner.lines
          .filter((line) => line.amount !== null && line.bottles > 0)
          .map((line) => ({
            name: line.productName.slice(0, 100),
            description: ['Consignment', line.outletCode, line.costFrom].filter(Boolean).join(' · '),
            quantity: line.bottles,
            rate: line.costPerBottle ?? 0,
          })),
        ...(owner.adjustments ? [{ name: 'Adjustment', quantity: 1, rate: owner.adjustments }] : []),
      );
      entry.total += owner.dueToOwner;
      billOwners.set(owner.partnerId, entry);
    }

    for (const line of outright.lines) {
      if (!line.ownerPartnerId || line.owed === null || line.paidThroughPco) continue;

      const entry = billOwners.get(line.ownerPartnerId) ?? {
        ownerName: line.ownerName ?? 'Owner',
        partnerId: line.ownerPartnerId,
        lines: [],
        total: 0,
      };

      entry.lines.push({
        name: line.productName.slice(0, 100),
        description: [
          line.basis === 'dispatch' ? 'Consignment, on dispatch' : line.basis === 'pco' ? 'Private client order' : 'Outright',
          line.invoiceNumber, line.customerName, line.costFrom].filter(Boolean).join(' · '),
        quantity: line.bottles,
        rate: line.costPerBottle ?? 0,
      });
      entry.total += line.owed;
      billOwners.set(line.ownerPartnerId, entry);
    }

    for (const owner of billOwners.values()) {
      if (owner.total <= 0) continue;

      const [partner] = owner.partnerId
        ? await client<{ zohoVendorId: string | null }[]>`
            SELECT zoho_vendor_id AS "zohoVendorId" FROM partners WHERE id = ${owner.partnerId}
          `
        : [];

      if (!partner?.zohoVendorId) {
        bills.push({ owner: owner.ownerName, problem: 'No Zoho vendor on their partner record' });
        continue;
      }

      try {
        const bill = await createBill({
          vendor_id: partner.zohoVendorId,
          reference_number: reference,
          date: new Date().toISOString().slice(0, 10),
          line_items: owner.lines,
          notes: `Sales of your wine for ${input.month}: consignment at ${outlet.name} and outright sales to customers.`,
        });

        bills.push({ owner: owner.ownerName, billId: bill.bill_id, billNumber: bill.bill_number });
      } catch (error) {
        logger.error('Settlement bill failed', {
          owner: owner.ownerName,
          month: input.month,
          error: error instanceof Error ? error.message : String(error),
        });
        bills.push({
          owner: owner.ownerName,
          problem: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await client`
      UPDATE cons_month_closes
      SET zoho_invoice_id = ${invoice.invoice_id},
          zoho_invoice_number = ${invoice.invoice_number},
          zoho_bills = ${JSON.stringify(bills)}::jsonb
      WHERE outlet_id = ${input.outletId} AND month = ${input.month}
    `;

    return {
      invoiceNumber: invoice.invoice_number,
      bills: bills.filter((row) => row.billId).length,
      problems: bills.filter((row) => row.problem),
    };
  });

export default adminApproveMonth;
