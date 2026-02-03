/**
 * Zoho Create Invoice Job
 *
 * Event-driven job to create an invoice in Zoho Books when an order payment is confirmed.
 * Triggered when order status changes to 'client_paid'.
 */

import { logger, task } from '@trigger.dev/sdk';
import { eq } from 'drizzle-orm';

import {
  partners,
  privateClientOrderItems,
  privateClientOrders,
} from '@/database/schema';
import { isZohoConfigured } from '@/lib/zoho/client';
import { createContact, upsertContactByEmail } from '@/lib/zoho/contacts';
import { createInvoice } from '@/lib/zoho/invoices';
import triggerDb from '@/trigger/triggerDb';

interface ZohoCreateInvoicePayload {
  orderId: string;
}

export const zohoCreateInvoiceJob = task({
  id: 'zoho-create-invoice',
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
  },
  async run(payload: ZohoCreateInvoicePayload) {
    logger.info('Creating Zoho invoice', { orderId: payload.orderId });

    if (!isZohoConfigured()) {
      logger.warn('Zoho integration not configured');
      return { success: false, reason: 'not_configured' };
    }

    // Fetch order with partner
    const [order] = await triggerDb
      .select({
        id: privateClientOrders.id,
        orderNumber: privateClientOrders.orderNumber,
        partnerId: privateClientOrders.partnerId,
        clientName: privateClientOrders.clientName,
        totalUsd: privateClientOrders.totalUsd,
        zohoInvoiceId: privateClientOrders.zohoInvoiceId,
      })
      .from(privateClientOrders)
      .where(eq(privateClientOrders.id, payload.orderId))
      .limit(1);

    if (!order) {
      logger.error('Order not found', { orderId: payload.orderId });
      return { success: false, reason: 'order_not_found' };
    }

    if (order.zohoInvoiceId) {
      logger.info('Invoice already exists', {
        orderId: order.id,
        zohoInvoiceId: order.zohoInvoiceId,
      });
      return { success: true, reason: 'already_exists' };
    }

    // Fetch partner
    let partner = null;
    if (order.partnerId) {
      [partner] = await triggerDb
        .select()
        .from(partners)
        .where(eq(partners.id, order.partnerId))
        .limit(1);
    }

    // Ensure partner has Zoho contact ID
    let zohoContactId = partner?.zohoContactId;
    if (partner && !zohoContactId) {
      logger.info('Creating Zoho contact for partner', {
        partnerId: partner.id,
      });

      const contact = await upsertContactByEmail({
        contact_name: partner.businessName,
        email: partner.businessEmail ?? undefined,
        phone: partner.businessPhone ?? undefined,
        billing_address: partner.businessAddress
          ? { address: partner.businessAddress }
          : undefined,
        contact_type: 'customer',
      });

      zohoContactId = contact.contact_id;

      // Update partner with Zoho contact ID
      await triggerDb
        .update(partners)
        .set({
          zohoContactId: contact.contact_id,
          zohoLastSyncAt: new Date(),
        })
        .where(eq(partners.id, partner.id));
    }

    if (!zohoContactId) {
      // Create a contact for the client directly
      const contact = await createContact({
        contact_name: order.clientName,
        contact_type: 'customer',
      });
      zohoContactId = contact.contact_id;
    }

    // Fetch order items
    const items = await triggerDb
      .select()
      .from(privateClientOrderItems)
      .where(eq(privateClientOrderItems.orderId, order.id));

    // Create invoice in Zoho
    const invoice = await createInvoice({
      customer_id: zohoContactId,
      reference_number: order.orderNumber,
      line_items: items.map((item) => ({
        name: item.productName,
        description: `${item.vintage ?? ''} ${item.productName}`.trim(),
        quantity: item.quantityCases,
        rate: item.totalUsd / item.quantityCases,
      })),
      notes: `Order ${order.orderNumber}`,
    });

    // Update order with Zoho invoice details
    await triggerDb
      .update(privateClientOrders)
      .set({
        zohoInvoiceId: invoice.invoice_id,
        zohoInvoiceNumber: invoice.invoice_number,
        zohoInvoiceStatus: invoice.status,
        zohoLastSyncAt: new Date(),
      })
      .where(eq(privateClientOrders.id, order.id));

    logger.info('Zoho invoice created', {
      orderId: order.id,
      invoiceId: invoice.invoice_id,
      invoiceNumber: invoice.invoice_number,
    });

    return {
      success: true,
      invoiceId: invoice.invoice_id,
      invoiceNumber: invoice.invoice_number,
    };
  },
});
