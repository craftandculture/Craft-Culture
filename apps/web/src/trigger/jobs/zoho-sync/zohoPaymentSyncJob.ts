/**
 * Zoho Payment Sync Job
 *
 * Runs every 4 hours to sync invoice payment status from Zoho Books.
 * Updates order status when payments are received in Zoho.
 */

import { logger, schedules } from '@trigger.dev/sdk';
import { and, eq, isNotNull, notInArray } from 'drizzle-orm';

import { privateClientOrders } from '@/database/schema';
import { isZohoConfigured } from '@/lib/zoho/client';
import { getInvoice } from '@/lib/zoho/invoices';
import triggerDb from '@/trigger/triggerDb';

export const zohoPaymentSyncJob = schedules.task({
  id: 'zoho-payment-sync',
  cron: {
    pattern: '0 */4 * * *', // Every 4 hours
    timezone: 'Asia/Dubai',
  },
  async run() {
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
    const orders = await triggerDb
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
          await triggerDb
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
  },
});
