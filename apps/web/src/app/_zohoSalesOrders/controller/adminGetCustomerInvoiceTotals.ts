import { ilike, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { zohoInvoices } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * What we have invoiced a customer, counted and totalled.
 *
 * Grouped by the customer's Zoho record and by currency, never summed across
 * either. Zoho holds duplicate customer records — the LPO matcher refuses
 * rather than guess between them for the same reason — so one business can
 * hold two ids, and a single figure would quietly report half the trade.
 * Currencies are kept apart because AED and USD do not add up.
 *
 * Draft and void invoices are absent by construction: the sync does not store
 * them, which is the right reading of "invoiced".
 *
 * @example
 *   adminGetCustomerInvoiceTotals({ search: 'C D General' });
 *
 * @param input - Part of the customer's name
 * @returns Per-record and per-currency counts, totals and outstanding balances
 */
const adminGetCustomerInvoiceTotals = adminProcedure
  .input(z.object({ search: z.string().min(2) }))
  .query(async ({ input }) => {
    const match = ilike(zohoInvoices.customerName, `%${input.search}%`);

    const groups = await db
      .select({
        zohoCustomerId: zohoInvoices.zohoCustomerId,
        customerName: zohoInvoices.customerName,
        currencyCode: zohoInvoices.currencyCode,
        invoiceCount: sql<number>`COUNT(*)::int`,
        total: sql<number>`ROUND(SUM(${zohoInvoices.total})::numeric, 2)::float8`,
        balance: sql<number>`ROUND(SUM(${zohoInvoices.balance})::numeric, 2)::float8`,
        firstInvoice: sql<string | null>`MIN(${zohoInvoices.invoiceDate})::text`,
        lastInvoice: sql<string | null>`MAX(${zohoInvoices.invoiceDate})::text`,
      })
      .from(zohoInvoices)
      .where(match)
      .groupBy(
        zohoInvoices.zohoCustomerId,
        zohoInvoices.customerName,
        zohoInvoices.currencyCode,
      )
      .orderBy(sql`SUM(${zohoInvoices.total}) DESC`);

    const byStatus = await db
      .select({
        status: zohoInvoices.status,
        currencyCode: zohoInvoices.currencyCode,
        invoiceCount: sql<number>`COUNT(*)::int`,
        total: sql<number>`ROUND(SUM(${zohoInvoices.total})::numeric, 2)::float8`,
      })
      .from(zohoInvoices)
      .where(match)
      .groupBy(zohoInvoices.status, zohoInvoices.currencyCode)
      .orderBy(sql`SUM(${zohoInvoices.total}) DESC`);

    const invoices = await db
      .select({
        invoiceNumber: zohoInvoices.invoiceNumber,
        invoiceDate: sql<string>`${zohoInvoices.invoiceDate}::text`,
        status: zohoInvoices.status,
        currencyCode: zohoInvoices.currencyCode,
        total: zohoInvoices.total,
        balance: zohoInvoices.balance,
        subject: zohoInvoices.subject,
        customerName: zohoInvoices.customerName,
      })
      .from(zohoInvoices)
      .where(match)
      .orderBy(zohoInvoices.invoiceDate);

    const [freshness] = await db
      .select({
        lastSyncAt: sql<Date | null>`MAX(${zohoInvoices.lastSyncAt})`,
        storedInvoices: sql<number>`COUNT(*)::int`,
      })
      .from(zohoInvoices);

    return {
      search: input.search,
      groups,
      byStatus,
      invoices,
      /*
        How current the answer is. This reads the synced copy, not Zoho, so an
        old sync gives an old total — and a total that is quietly stale is
        worse than one that says so.
      */
      lastSyncAt: freshness?.lastSyncAt ?? null,
      storedInvoicesTotal: freshness?.storedInvoices ?? 0,
    };
  });

export default adminGetCustomerInvoiceTotals;
