import syncInvoicesFromZoho from '@/app/_zohoSalesOrders/data/syncInvoicesFromZoho';
import { adminProcedure } from '@/lib/trpc/procedures';
import { isZohoConfigured } from '@/lib/zoho/client';

/**
 * Sync all invoices from Zoho Books into the zohoInvoices table. Paginates
 * through all invoices and upserts each one.
 *
 * @example
 *   await trpcClient.zohoSalesOrders.syncInvoices.mutate();
 */
const adminSyncZohoInvoices = adminProcedure.mutation(async () => {
  if (!isZohoConfigured()) {
    return { created: 0, updated: 0, total: 0, message: 'Zoho not configured' };
  }

  const result = await syncInvoicesFromZoho();
  const total = result.created + result.updated;

  return {
    created: result.created,
    updated: result.updated,
    total,
    removed: result.removed,
    message:
      `Synced ${total} invoices (${result.created} new, ${result.updated} updated)` +
      (result.removed > 0
        ? `; removed ${result.removed} void/deleted (${result.prunedInvoices.join(', ')})`
        : '') +
      (result.prunedSkipped
        ? `; ${result.prunedInvoices.length} invoices missing from Zoho were NOT removed — too many at once to trust`
        : ''),
  };
});

export default adminSyncZohoInvoices;
