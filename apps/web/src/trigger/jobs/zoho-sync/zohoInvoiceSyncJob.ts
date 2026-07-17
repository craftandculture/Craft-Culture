/**
 * Zoho Invoice Sync Job
 *
 * Scheduled job that syncs invoices from Zoho Books into the zohoInvoices table.
 * Runs every 10 minutes to keep revenue KPIs up to date.
 */

import { logger, schedules } from '@trigger.dev/sdk';
import { eq } from 'drizzle-orm';

import { zohoInvoices } from '@/database/schema';
import { isZohoConfigured } from '@/lib/zoho/client';
import { listInvoices } from '@/lib/zoho/invoices';
import triggerDb from '@/trigger/triggerDb';

export const zohoInvoiceSyncJob = schedules.task({
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

    const results = { created: 0, updated: 0, errors: 0 };
    let page = 1;
    let hasMore = true;

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

        for (const inv of result.invoices) {
          if (inv.status === 'draft' || inv.status === 'void') continue;

          try {
            const [existing] = await triggerDb
              .select({ id: zohoInvoices.id })
              .from(zohoInvoices)
              .where(eq(zohoInvoices.zohoInvoiceId, inv.invoice_id))
              .limit(1);

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
              await triggerDb.insert(zohoInvoices).values({
                zohoInvoiceId: inv.invoice_id,
                invoiceNumber: inv.invoice_number,
                zohoCustomerId: inv.customer_id,
                customerName: inv.customer_name,
                status: inv.status,
                invoiceDate: new Date(inv.date),
                dueDate: inv.due_date ? new Date(inv.due_date) : null,
                referenceNumber: inv.reference_number ?? null,
                subTotal: inv.sub_total ?? 0,
                total: inv.total ?? 0,
                balance: inv.balance ?? 0,
                currencyCode: inv.currency_code,
                lastSyncAt: now,
              });
              results.created++;
            }
          } catch (error) {
            results.errors++;
            logger.error(`Failed to sync invoice ${inv.invoice_number}`, { error });
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

    logger.info('Zoho invoice sync completed', results);
    return results;
  },
});
