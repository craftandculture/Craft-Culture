import { and, eq, isNotNull, notInArray } from 'drizzle-orm';

import db from '@/database/client';
import { privateClientOrders } from '@/database/schema';
import { isZohoConfigured } from '@/lib/zoho/client';
import { getInvoice } from '@/lib/zoho/invoices';
import logger from '@/utils/logger';

/**
 * Bring each PCO's Zoho invoice status up to date
 *
 * Checks up to 100 orders whose Zoho invoice is not yet paid. Ran on
 * Trigger.dev every four hours; since Trigger.dev was switched off in
 * October 2026 a Vercel cron calls this instead, on the same schedule.
 *
 * @returns How many orders were checked, updated and failed
 */
const syncPcoPaymentsFromZoho = async () => {
  logger.info('Starting Zoho payment sync');

  if (!isZohoConfigured()) {
    logger.warn('Zoho integration not configured, skipping sync');
    return { skipped: true, reason: 'not_configured' };
  }

  const results = {
    checked: 0,
    updated: 0,
    errors: 0,
  };

  // Get orders with Zoho invoice IDs that aren't fully paid
  const orders = await db
    .select({
      id: privateClientOrders.id,
      orderNumber: privateClientOrders.orderNumber,
      zohoInvoiceId: privateClientOrders.zohoInvoiceId,
      zohoInvoiceStatus: privateClientOrders.zohoInvoiceStatus,
    })
    .from(privateClientOrders)
    .where(
      and(
        isNotNull(privateClientOrders.zohoInvoiceId),
        notInArray(privateClientOrders.zohoInvoiceStatus ?? '', ['paid']),
      ),
    )
    .limit(100);

  logger.info(`Found ${orders.length} orders to check`);

  for (const order of orders) {
    results.checked++;

    try {
      const invoice = await getInvoice(order.zohoInvoiceId!);

      if (invoice.status !== order.zohoInvoiceStatus) {
        await db
          .update(privateClientOrders)
          .set({
            zohoInvoiceStatus: invoice.status,
            zohoLastSyncAt: new Date(),
          })
          .where(eq(privateClientOrders.id, order.id));

        results.updated++;
        logger.info(`Updated order ${order.orderNumber}`, {
          oldStatus: order.zohoInvoiceStatus,
          newStatus: invoice.status,
        });
      }
    } catch (error) {
      results.errors++;
      logger.error(`Failed to sync order ${order.orderNumber}`, { error });
    }
  }

  logger.info('Zoho payment sync completed', results);

  return results;
};

export default syncPcoPaymentsFromZoho;
