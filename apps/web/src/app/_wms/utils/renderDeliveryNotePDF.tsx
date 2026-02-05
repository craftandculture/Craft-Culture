import { pdf } from '@react-pdf/renderer';

import DeliveryNotePDFTemplate from '../components/DeliveryNotePDFTemplate';
import type { DeliveryNotePDFTemplateProps } from '../components/DeliveryNotePDFTemplate';

/**
 * Render a delivery note PDF to a Buffer for storage/email
 *
 * @example
 *   const pdfBuffer = await renderDeliveryNotePDF({
 *     deliveryNote: { deliveryNoteNumber: 'DN-001', generatedAt: new Date() },
 *     batch: { batchNumber: 'BATCH-001', distributorName: 'Distributor', ... },
 *     orders: [...],
 *   });
 *   const base64 = pdfBuffer.toString('base64');
 *
 * @param props - The data for the delivery note
 * @returns Buffer containing the PDF data
 */
const renderDeliveryNotePDF = async (props: DeliveryNotePDFTemplateProps): Promise<Buffer> => {
  const pdfDocument = pdf(<DeliveryNotePDFTemplate {...props} />);
  const stream = await pdfDocument.toBuffer();

  // toBuffer() returns a NodeJS.ReadableStream, convert to Buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Uint8Array);
  }

  return Buffer.concat(chunks);
};

export default renderDeliveryNotePDF;
