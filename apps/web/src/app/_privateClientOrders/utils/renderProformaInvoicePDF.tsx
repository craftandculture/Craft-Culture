import { pdf } from '@react-pdf/renderer';

import ProformaInvoicePDFTemplate from '../components/ProformaInvoicePDFTemplate';
import type { ProformaInvoicePDFTemplateProps } from '../components/ProformaInvoicePDFTemplate';

/**
 * Render a proforma invoice PDF to a Buffer for email attachment
 *
 * @example
 *   const pdfBuffer = await renderProformaInvoicePDF({
 *     order: { orderNumber: 'PCO-001', ... },
 *     lineItems: [...],
 *     partner: { businessName: 'Wine Partner' },
 *     distributor: { businessName: 'Distributor Co' },
 *   });
 *   const base64 = pdfBuffer.toString('base64');
 *
 * @param props - The data for the proforma invoice
 * @returns Buffer containing the PDF data
 */
const renderProformaInvoicePDF = async (props: ProformaInvoicePDFTemplateProps): Promise<Buffer> => {
  const pdfDocument = pdf(<ProformaInvoicePDFTemplate {...props} />);
  const stream = await pdfDocument.toBuffer();

  // toBuffer() returns a NodeJS.ReadableStream, convert to Buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Uint8Array);
  }

  return Buffer.concat(chunks);
};

export default renderProformaInvoicePDF;
