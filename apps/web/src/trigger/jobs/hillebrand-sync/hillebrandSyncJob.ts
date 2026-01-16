import { logger, schedules } from '@trigger.dev/sdk';

import {
  syncHillebrandDocuments,
  syncHillebrandInvoices,
  syncHillebrandShipments,
} from '@/app/_logistics/integrations/hillebrand';

/**
 * Hillebrand Sync Job
 *
 * Runs every 4 hours to sync shipments, invoices, and documents from Hillebrand API.
 * This ensures our logistics data stays up-to-date with the forwarder's system.
 *
 * Syncs in order:
 * 1. Shipments - creates/updates shipment records
 * 2. Invoices - creates/updates invoice records, links to shipments
 * 3. Documents - fetches documents for each shipment
 */
export const hillebrandSyncJob = schedules.task({
  id: 'hillebrand-sync',
  cron: {
    pattern: '0 */4 * * *', // Every 4 hours
    timezone: 'Asia/Dubai',
  },
  async run() {
    logger.info('Starting scheduled Hillebrand sync');

    const results = {
      shipments: { created: 0, updated: 0, errors: 0 },
      invoices: { created: 0, updated: 0, errors: 0 },
      documents: { created: 0, updated: 0, errors: 0 },
    };

    // 1. Sync Shipments
    try {
      logger.info('Syncing Hillebrand shipments...');
      const shipmentResult = await syncHillebrandShipments();
      results.shipments = {
        created: shipmentResult.created,
        updated: shipmentResult.updated,
        errors: shipmentResult.errors,
      };
      logger.info('Shipment sync complete', results.shipments);
    } catch (error) {
      logger.error('Shipment sync failed', { error });
      results.shipments.errors = 1;
    }

    // 2. Sync Invoices
    try {
      logger.info('Syncing Hillebrand invoices...');
      const invoiceResult = await syncHillebrandInvoices();
      results.invoices = {
        created: invoiceResult.created,
        updated: invoiceResult.updated,
        errors: invoiceResult.errors,
      };
      logger.info('Invoice sync complete', results.invoices);
    } catch (error) {
      logger.error('Invoice sync failed', { error });
      results.invoices.errors = 1;
    }

    // 3. Sync Documents
    try {
      logger.info('Syncing Hillebrand documents...');
      const documentResult = await syncHillebrandDocuments();
      results.documents = {
        created: documentResult.created,
        updated: documentResult.updated,
        errors: documentResult.errors,
      };
      logger.info('Document sync complete', results.documents);
    } catch (error) {
      logger.error('Document sync failed', { error });
      results.documents.errors = 1;
    }

    logger.info('Hillebrand sync completed', {
      totalCreated:
        results.shipments.created + results.invoices.created + results.documents.created,
      totalUpdated:
        results.shipments.updated + results.invoices.updated + results.documents.updated,
      totalErrors:
        results.shipments.errors + results.invoices.errors + results.documents.errors,
    });

    return results;
  },
});
