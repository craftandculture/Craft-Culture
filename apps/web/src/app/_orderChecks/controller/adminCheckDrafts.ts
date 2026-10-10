import { PEGGED } from '@/app/_logistics/utils/resolveFxToUsd';
import { adminProcedure } from '@/lib/trpc/procedures';
import { listInvoices } from '@/lib/zoho/invoices';
import { listSalesOrders } from '@/lib/zoho/salesOrders';
import logger from '@/utils/logger';

import { type CheckDocument, invoiceDocument, salesOrderDocument } from '../data/fetchCheckDocument';
import loadCheckContext from '../data/loadCheckContext';
import checkOrderLines from '../utils/checkOrderLines';

/** Newest drafts of each kind to check; each one is a Zoho call */
const PER_KIND = 15;

/**
 * Check every draft sales order and invoice waiting in Zoho
 *
 * Drafts are what is about to be sent, so they are where a wrong code or
 * price is still cheap to fix. Read live — drafts are never synced — newest
 * first, up to fifteen of each. One that cannot be read is reported, not
 * allowed to stop the rest.
 */
const adminCheckDrafts = adminProcedure.query(async () => {
  const [sos, invs, context] = await Promise.all([
    listSalesOrders({ status: 'draft', perPage: PER_KIND }),
    listInvoices({ status: 'draft', perPage: PER_KIND }),
    loadCheckContext(),
  ]);

  const loaders: { number: string; load: () => Promise<CheckDocument> }[] = [
    ...(sos.salesOrders ?? []).slice(0, PER_KIND).map((s) => ({ number: s.salesorder_number, load: () => salesOrderDocument(s.salesorder_id) })),
    ...(invs.invoices ?? []).slice(0, PER_KIND).map((i) => ({ number: i.invoice_number, load: () => invoiceDocument(i.invoice_id) })),
  ];

  const results = [];
  // One at a time: Zoho rate-limits bursts
  for (const { number, load } of loaders) {
    try {
      const doc = await load();
      const check = checkOrderLines(doc.lines, {
        ...context,
        currency: doc.currency,
        toUsd: PEGGED[doc.currency] ?? null,
        comparePrices: true,
      });
      results.push({ document: { ...doc, lines: undefined }, ...check, failed: null as string | null });
    } catch (error) {
      logger.error('Could not check a draft', { number, error });
      results.push({ document: { number }, failed: error instanceof Error ? error.message : 'Could not read it' });
    }
  }

  return { checkedAt: new Date(), results };
});

export default adminCheckDrafts;
