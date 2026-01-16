import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsInvoiceShipments, logisticsInvoices, logisticsShipments } from '@/database/schema';
import logger from '@/utils/logger';

import { getHillebrandInvoices } from './getInvoices';
import type { HillebrandInvoice } from './getInvoices';

type OurInvoiceStatus = 'open' | 'paid' | 'overdue' | 'disputed' | 'cancelled';

/**
 * Map Hillebrand invoice status to our status enum
 */
const mapHillebrandInvoiceStatus = (status: string): OurInvoiceStatus => {
  const statusMap: Record<string, OurInvoiceStatus> = {
    open: 'open',
    paid: 'paid',
    overdue: 'overdue',
  };

  return statusMap[status.toLowerCase()] ?? 'open';
};

/**
 * Parse a date string from Hillebrand API
 */
const parseHillebrandDate = (dateStr: string | undefined): Date | null => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
};

interface SyncResult {
  created: number;
  updated: number;
  linked: number;
  errors: number;
  invoices: Array<{
    hillebrandId: number;
    invoiceNumber: string;
    action: 'created' | 'updated' | 'error';
    error?: string;
  }>;
}

/**
 * Sync invoices from Hillebrand API to our database
 *
 * Creates new invoices or updates existing ones based on hillebrandInvoiceId.
 * Links invoices to shipments based on shipmentReferences.
 */
const syncHillebrandInvoices = async (): Promise<SyncResult> => {
  const result: SyncResult = {
    created: 0,
    updated: 0,
    linked: 0,
    errors: 0,
    invoices: [],
  };

  try {
    logger.info('Fetching Hillebrand invoices');

    // Fetch all invoices (paginate if needed)
    const allInvoices: HillebrandInvoice[] = [];
    let page = 1;
    const pageSize = 100;

    while (true) {
      const invoices = await getHillebrandInvoices({ page, pageSize });
      allInvoices.push(...invoices);

      if (invoices.length < pageSize) {
        break;
      }
      page++;
    }

    logger.info('Fetched Hillebrand invoices', { count: allInvoices.length });

    // Build a map of Hillebrand shipment IDs to our shipment IDs
    const shipmentMap = new Map<number, string>();
    const shipments = await db
      .select({
        id: logisticsShipments.id,
        hillebrandShipmentId: logisticsShipments.hillebrandShipmentId,
      })
      .from(logisticsShipments);

    for (const shipment of shipments) {
      if (shipment.hillebrandShipmentId) {
        shipmentMap.set(shipment.hillebrandShipmentId, shipment.id);
      }
    }

    for (const hInvoice of allInvoices) {
      try {
        // Check if we already have this invoice
        const [existing] = await db
          .select({ id: logisticsInvoices.id })
          .from(logisticsInvoices)
          .where(eq(logisticsInvoices.hillebrandInvoiceId, hInvoice.id))
          .limit(1);

        const invoiceDate = parseHillebrandDate(hInvoice.invoiceDate);
        const paymentDueDate = parseHillebrandDate(hInvoice.paymentDueDate);

        if (!invoiceDate) {
          throw new Error('Invalid invoice date');
        }

        const invoiceData = {
          hillebrandInvoiceId: hInvoice.id,
          hillebrandLastSync: new Date(),
          invoiceNumber: hInvoice.invoiceNumber,
          invoiceDate,
          paymentDueDate,
          status: mapHillebrandInvoiceStatus(hInvoice.invoiceStatus),
          currencyCode: hInvoice.currencyCode || 'USD',
          totalAmount: hInvoice.totalAmount,
          openAmount: hInvoice.openAmount,
          paidAmount: hInvoice.totalAmount - hInvoice.openAmount,
          paidAt: hInvoice.invoiceStatus === 'paid' ? new Date() : null,
        };

        let invoiceId: string;

        if (existing) {
          // Update existing invoice
          await db
            .update(logisticsInvoices)
            .set({
              ...invoiceData,
              updatedAt: new Date(),
            })
            .where(eq(logisticsInvoices.id, existing.id));

          invoiceId = existing.id;
          result.updated++;
          result.invoices.push({
            hillebrandId: hInvoice.id,
            invoiceNumber: hInvoice.invoiceNumber,
            action: 'updated',
          });
        } else {
          // Create new invoice
          const [newInvoice] = await db
            .insert(logisticsInvoices)
            .values(invoiceData)
            .returning();

          invoiceId = newInvoice!.id;
          result.created++;
          result.invoices.push({
            hillebrandId: hInvoice.id,
            invoiceNumber: hInvoice.invoiceNumber,
            action: 'created',
          });
        }

        // Link invoice to shipments
        if (hInvoice.shipmentReferences && hInvoice.shipmentReferences.length > 0) {
          for (const shipmentRef of hInvoice.shipmentReferences) {
            const ourShipmentId = shipmentMap.get(shipmentRef.id);

            if (ourShipmentId) {
              // Check if link already exists
              const [existingLink] = await db
                .select({ id: logisticsInvoiceShipments.id })
                .from(logisticsInvoiceShipments)
                .where(eq(logisticsInvoiceShipments.invoiceId, invoiceId))
                .limit(1);

              if (!existingLink) {
                await db.insert(logisticsInvoiceShipments).values({
                  invoiceId,
                  shipmentId: ourShipmentId,
                });
                result.linked++;
              }
            }
          }
        }
      } catch (error) {
        result.errors++;
        result.invoices.push({
          hillebrandId: hInvoice.id,
          invoiceNumber: hInvoice.invoiceNumber,
          action: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        logger.error('Error syncing Hillebrand invoice', {
          hillebrandId: hInvoice.id,
          error,
        });
      }
    }

    logger.info('Hillebrand invoice sync complete', {
      created: result.created,
      updated: result.updated,
      linked: result.linked,
      errors: result.errors,
    });

    return result;
  } catch (error) {
    logger.error('Failed to sync Hillebrand invoices', { error });
    throw error;
  }
};

export default syncHillebrandInvoices;

export type { SyncResult as InvoiceSyncResult };
