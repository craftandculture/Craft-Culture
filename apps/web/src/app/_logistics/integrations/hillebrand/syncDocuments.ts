import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsDocuments, logisticsShipments } from '@/database/schema';
import logger from '@/utils/logger';

import { getHillebrandShipmentDocuments } from './getShipments';

type OurDocumentType =
  | 'bill_of_lading'
  | 'airway_bill'
  | 'commercial_invoice'
  | 'packing_list'
  | 'certificate_of_origin'
  | 'customs_declaration'
  | 'import_permit'
  | 'export_permit'
  | 'delivery_note'
  | 'health_certificate'
  | 'insurance_certificate'
  | 'proof_of_delivery'
  | 'other';

/**
 * Map Hillebrand document type to our document type enum
 */
const mapHillebrandDocumentType = (docType: string): OurDocumentType => {
  const typeMap: Record<string, OurDocumentType> = {
    // Bill of Lading variants
    bill_of_lading: 'bill_of_lading',
    bol: 'bill_of_lading',
    bl: 'bill_of_lading',
    master_bill_of_lading: 'bill_of_lading',
    house_bill_of_lading: 'bill_of_lading',

    // Airway Bill variants
    airway_bill: 'airway_bill',
    awb: 'airway_bill',
    air_waybill: 'airway_bill',

    // Commercial Invoice variants
    commercial_invoice: 'commercial_invoice',
    invoice: 'commercial_invoice',
    ci: 'commercial_invoice',

    // Packing List variants
    packing_list: 'packing_list',
    packing: 'packing_list',
    pl: 'packing_list',

    // Certificate of Origin variants
    certificate_of_origin: 'certificate_of_origin',
    coo: 'certificate_of_origin',
    origin_certificate: 'certificate_of_origin',

    // Customs Declaration variants
    customs_declaration: 'customs_declaration',
    customs: 'customs_declaration',
    customs_doc: 'customs_declaration',

    // Import/Export permits
    import_permit: 'import_permit',
    export_permit: 'export_permit',

    // Delivery Note variants
    delivery_note: 'delivery_note',
    delivery: 'delivery_note',
    dn: 'delivery_note',

    // Health Certificate variants
    health_certificate: 'health_certificate',
    phyto: 'health_certificate',
    phytosanitary: 'health_certificate',

    // Insurance Certificate variants
    insurance_certificate: 'insurance_certificate',
    insurance: 'insurance_certificate',

    // Proof of Delivery variants
    proof_of_delivery: 'proof_of_delivery',
    pod: 'proof_of_delivery',
  };

  return typeMap[docType.toLowerCase()] ?? 'other';
};

interface SyncResult {
  created: number;
  updated: number;
  errors: number;
  documents: Array<{
    hillebrandId: number;
    fileName: string;
    documentType: string;
    action: 'created' | 'updated' | 'error';
    error?: string;
  }>;
}

/**
 * Sync documents from Hillebrand for a single shipment
 */
const syncShipmentDocuments = async (
  ourShipmentId: string,
  hillebrandShipmentId: number,
): Promise<SyncResult> => {
  const result: SyncResult = {
    created: 0,
    updated: 0,
    errors: 0,
    documents: [],
  };

  try {
    const hillebrandDocs = await getHillebrandShipmentDocuments(hillebrandShipmentId);

    for (const hDoc of hillebrandDocs) {
      try {
        // Check if we already have this document
        const [existing] = await db
          .select({ id: logisticsDocuments.id })
          .from(logisticsDocuments)
          .where(eq(logisticsDocuments.hillebrandDocumentId, hDoc.id))
          .limit(1);

        const documentData = {
          shipmentId: ourShipmentId,
          hillebrandDocumentId: hDoc.id,
          hillebrandLastSync: new Date(),
          documentType: mapHillebrandDocumentType(hDoc.documentType),
          documentNumber: hDoc.documentNumber ?? null,
          fileName: hDoc.fileName ?? `document_${hDoc.id}.pdf`,
          fileUrl: hDoc.downloadUrl ?? '',
          hillebrandDownloadUrl: hDoc.downloadUrl ?? null,
          fileSize: hDoc.fileSize ?? null,
          mimeType: hDoc.mimeType ?? 'application/pdf',
        };

        if (existing) {
          // Update existing document
          await db
            .update(logisticsDocuments)
            .set({
              ...documentData,
              updatedAt: new Date(),
            })
            .where(eq(logisticsDocuments.id, existing.id));

          result.updated++;
          result.documents.push({
            hillebrandId: hDoc.id,
            fileName: documentData.fileName,
            documentType: documentData.documentType,
            action: 'updated',
          });
        } else {
          // Create new document
          await db.insert(logisticsDocuments).values({
            ...documentData,
            // uploadedBy is null for system imports
            uploadedBy: null,
          });

          result.created++;
          result.documents.push({
            hillebrandId: hDoc.id,
            fileName: documentData.fileName,
            documentType: documentData.documentType,
            action: 'created',
          });
        }
      } catch (error) {
        result.errors++;
        result.documents.push({
          hillebrandId: hDoc.id,
          fileName: hDoc.fileName ?? 'unknown',
          documentType: hDoc.documentType,
          action: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        logger.error('Error syncing Hillebrand document', {
          hillebrandDocId: hDoc.id,
          shipmentId: ourShipmentId,
          error,
        });
      }
    }
  } catch (error) {
    logger.error('Failed to fetch Hillebrand documents', {
      hillebrandShipmentId,
      error,
    });
    throw error;
  }

  return result;
};

/**
 * Sync documents from Hillebrand API for all shipments with Hillebrand IDs
 *
 * Fetches documents for each shipment and creates/updates records in our database.
 */
const syncHillebrandDocuments = async (): Promise<SyncResult> => {
  const totalResult: SyncResult = {
    created: 0,
    updated: 0,
    errors: 0,
    documents: [],
  };

  try {
    logger.info('Starting Hillebrand document sync');

    // Get all shipments with Hillebrand IDs
    const shipments = await db
      .select({
        id: logisticsShipments.id,
        hillebrandShipmentId: logisticsShipments.hillebrandShipmentId,
        shipmentNumber: logisticsShipments.shipmentNumber,
      })
      .from(logisticsShipments);

    const shipmentsWithHillebrand = shipments.filter((s) => s.hillebrandShipmentId !== null);

    logger.info('Found shipments with Hillebrand IDs', {
      total: shipments.length,
      withHillebrand: shipmentsWithHillebrand.length,
    });

    for (const shipment of shipmentsWithHillebrand) {
      try {
        const shipmentResult = await syncShipmentDocuments(
          shipment.id,
          shipment.hillebrandShipmentId!,
        );

        totalResult.created += shipmentResult.created;
        totalResult.updated += shipmentResult.updated;
        totalResult.errors += shipmentResult.errors;
        totalResult.documents.push(...shipmentResult.documents);

        logger.info('Synced documents for shipment', {
          shipmentId: shipment.id,
          shipmentNumber: shipment.shipmentNumber,
          created: shipmentResult.created,
          updated: shipmentResult.updated,
          errors: shipmentResult.errors,
        });
      } catch (error) {
        logger.error('Failed to sync documents for shipment', {
          shipmentId: shipment.id,
          hillebrandShipmentId: shipment.hillebrandShipmentId,
          error,
        });
        totalResult.errors++;
      }
    }

    logger.info('Hillebrand document sync complete', {
      created: totalResult.created,
      updated: totalResult.updated,
      errors: totalResult.errors,
    });

    return totalResult;
  } catch (error) {
    logger.error('Failed to sync Hillebrand documents', { error });
    throw error;
  }
};

export default syncHillebrandDocuments;

export type { SyncResult as DocumentSyncResult };
