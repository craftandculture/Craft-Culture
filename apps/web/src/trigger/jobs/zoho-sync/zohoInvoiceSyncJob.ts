/**
 * Zoho Invoice Sync Job
 *
 * Scheduled job that syncs invoices from Zoho Books into the zohoInvoices
 * table. Runs every 10 minutes to keep revenue KPIs up to date.
 */

import { logger, schedules } from '@trigger.dev/sdk';
import { eq, inArray } from 'drizzle-orm';

import syncInvoiceLines from '@/app/_zohoSalesOrders/data/syncInvoiceLines';
import pruneZohoInvoices from '@/app/_zohoSalesOrders/utils/pruneZohoInvoices';
import { zohoInvoices } from '@/database/schema';
import { isZohoConfigured } from '@/lib/zoho/client';
import { listInvoices } from '@/lib/zoho/invoices';
import triggerDb from '@/trigger/triggerDb';

export const zohoInvoiceSyncJob = schedules.task({
  // Scheduled every few minutes: the next run is the retry. Without these the
  // project defaults (5 attempts, 5 hours) let failing runs pile up and spend
  // the Trigger.dev budget (25 Oct 2026).
  retry: { maxAttempts: 1 },
  maxDuration: 8 * 60,
  id: 'zoho-invoice-sync',
  cron: {
    pattern: '*/10 * * * *',
    timezone: 'Asia/Dubai',
  },
  async run() {
    logger.info('Starting Zoho invoice sync');

    if (!isZohoConfigured()) {
      logger.warn('Zoho integration not configured, skipping sync');
      return { skipped: true, reason: 'not_configured' };
    }

    const results = { created: 0, updated: 0, errors: 0, removed: 0 };
    let page = 1;
    let hasMore = true;
    const seenIds = new Set<string>();
    const voidIds = new Set<string>();
    let consecutiveFailures = 0;
    // Invoices whose lines may need reading (Index 3.0)
    const forLines: { invoiceId: string; invoiceNumber: string; lastModified: string | null }[] = [];

    try {
      while (hasMore) {
        const result = await listInvoices({ page, perPage: 200 });

        // Guard against a malformed/error response shape (e.g. Zoho returns an
        // error body with no `invoices`/`page_context`). Surface it as a failed
        // run rather than crashing mid-loop or silently syncing nothing.
        if (!result || !Array.isArray(result.invoices) || !result.pageContext) {
          throw new Error(
            `Zoho invoices response malformed on page ${page} (missing invoices/page_context)`,
          );
        }

        // One read per page for which invoices are already held, not one per invoice
        const pageIds = result.invoices.map((inv) => inv.invoice_id);
        const heldRows = pageIds.length
          ? await triggerDb
              .select({ id: zohoInvoices.id, zohoInvoiceId: zohoInvoices.zohoInvoiceId })
              .from(zohoInvoices)
              .where(inArray(zohoInvoices.zohoInvoiceId, pageIds))
          : [];
        const heldByZohoId = new Map(heldRows.map((row) => [row.zohoInvoiceId, row.id]));

        for (const inv of result.invoices) {
          seenIds.add(inv.invoice_id);
          if (inv.status === 'void') voidIds.add(inv.invoice_id);
          if (inv.status === 'draft' || inv.status === 'void') continue;
          forLines.push({
            invoiceId: inv.invoice_id,
            invoiceNumber: inv.invoice_number,
            lastModified: inv.last_modified_time ?? null,
          });

          try {
            const existingId = heldByZohoId.get(inv.invoice_id);
            const existing = existingId ? { id: existingId } : undefined;

            const now = new Date();

            if (existing) {
              await triggerDb
                .update(zohoInvoices)
                .set({
                  invoiceNumber: inv.invoice_number,
                  customerName: inv.customer_name,
                  status: inv.status,
                  invoiceDate: new Date(inv.date),
                  dueDate: inv.due_date ? new Date(inv.due_date) : null,
                  referenceNumber: inv.reference_number ?? null,
                  // What kind of invoice this is, in the business's own words —
                  // CONSIGNMENT_CRURATED and its siblings live here
                  subject: inv.subject ?? null,
                  paymentTerms: inv.payment_terms_label ?? null,
                  subTotal: inv.sub_total ?? 0,
                  total: inv.total ?? 0,
                  balance: inv.balance ?? 0,
                  currencyCode: inv.currency_code,
                  lastSyncAt: now,
                  updatedAt: now,
                })
                .where(eq(zohoInvoices.id, existing.id));
              results.updated++;
            } else {
              const [created] = await triggerDb.insert(zohoInvoices).values({
                zohoInvoiceId: inv.invoice_id,
                invoiceNumber: inv.invoice_number,
                zohoCustomerId: inv.customer_id,
                customerName: inv.customer_name,
                status: inv.status,
                invoiceDate: new Date(inv.date),
                dueDate: inv.due_date ? new Date(inv.due_date) : null,
                referenceNumber: inv.reference_number ?? null,
                // What kind of invoice this is, in the business's own words —
                // CONSIGNMENT_CRURATED and its siblings live here
                subject: inv.subject ?? null,
                paymentTerms: inv.payment_terms_label ?? null,
                subTotal: inv.sub_total ?? 0,
                total: inv.total ?? 0,
                balance: inv.balance ?? 0,
                currencyCode: inv.currency_code,
                lastSyncAt: now,
              }).returning({ id: zohoInvoices.id });
              if (created) heldByZohoId.set(inv.invoice_id, created.id);
              results.created++;
            }
            consecutiveFailures = 0;
          } catch (error) {
            results.errors++;
            consecutiveFailures++;
            logger.error(`Failed to sync invoice ${inv.invoice_number}`, {
              error,
            });
            /*
              Five in a row is the database, not the invoices. On 25 Oct 2026 a
              stale DB password made every write fail slowly; each run then
              spent ~20 minutes failing 356 invoices one by one, runs piled up
              on the 10-minute schedule and exhausted the Trigger.dev budget.
            */
            if (consecutiveFailures >= 5) {
              throw new Error(
                `Zoho invoice sync stopped after ${consecutiveFailures} failed writes in a row: ${error instanceof Error ? error.message : String(error)}`,
              );
            }
          }
        }

        hasMore = result.pageContext.has_more_page;
        page++;
      }
    } catch (error) {
      // Don't swallow — a fetch/token/parse failure must FAIL the run so
      // Trigger.dev surfaces and alerts it, rather than the sync silently
      // freezing (as it did for ~10 days in Jul 2026 while sales-order sync
      // kept working and the revenue KPIs quietly went stale).
      logger.error('Failed to fetch invoices from Zoho', { error });
      throw error;
    }

    // If every write failed, don't report a green run — fail loudly so the
    // outage is visible instead of the table freezing at its last good state.
    if (results.errors > 0 && results.created + results.updated === 0) {
      throw new Error(
        `Zoho invoice sync wrote nothing across ${results.errors} errors — failing run to surface the outage`,
      );
    }

    // Reached only when every page was read — see pruneZohoInvoices.
    const pruned = await pruneZohoInvoices({ seenIds, voidIds, db: triggerDb });
    results.removed = pruned.removed;
    if (pruned.removed > 0) {
      logger.info('Removed void/deleted invoices', { invoices: pruned.invoices });
    }
    if (pruned.skipped) {
      logger.warn('Invoices missing from Zoho NOT removed — too many at once', {
        invoices: pruned.invoices,
      });
    }

    /*
      Invoice lines, for invoices new or changed since last read. Its own
      try: the balances above are what the team relies on every ten minutes,
      and a slow or failing line read must never hold them up.
    */
    try {
      const lines = await syncInvoiceLines({ invoices: forLines, db: triggerDb });
      logger.info('Zoho invoice lines read', lines);
    } catch (error) {
      logger.error('Zoho invoice lines not read this run', { error });
    }

    logger.info('Zoho invoice sync completed', results);
    return results;
  },
});
