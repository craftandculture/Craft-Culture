import { pdf } from '@react-pdf/renderer';

import ExportInvoicePDFTemplate from '../components/ExportInvoicePDFTemplate';
import type { ExportDocument } from '../schemas/exportDocumentSchema';

/**
 * Render an export invoice to a PDF buffer
 *
 * @param document - The export document
 * @returns The PDF bytes
 */
const renderExportInvoicePDF = async (document: ExportDocument): Promise<Buffer> => {
  const stream = await pdf(<ExportInvoicePDFTemplate document={document} />).toBuffer();
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Uint8Array);
  }
  return Buffer.concat(chunks);
};

export default renderExportInvoicePDF;
