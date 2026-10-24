import type { logisticsDocuments } from '@/database/schema';

/**
 * A shipment document as a partner may see it
 *
 * Extracted data, staff notes and verification details stay private.
 *
 * @param doc - The full document row
 * @returns The fields a partner may see
 */
const toPartnerShipmentDocument = (doc: typeof logisticsDocuments.$inferSelect) => ({
  id: doc.id,
  documentType: doc.documentType,
  documentNumber: doc.documentNumber,
  fileUrl: doc.fileUrl,
  fileName: doc.fileName,
  fileSize: doc.fileSize,
  mimeType: doc.mimeType,
  issueDate: doc.issueDate,
  expiryDate: doc.expiryDate,
  uploadedAt: doc.uploadedAt,
});

export default toPartnerShipmentDocument;
