import { pdf } from '@react-pdf/renderer';

import OrderSummaryPDFTemplate from '../components/OrderSummaryPDFTemplate';
import type { OrderSummaryPDFTemplateProps } from '../components/OrderSummaryPDFTemplate';

/**
 * Render a multi-order summary PDF to a Buffer
 *
 * @param props - The data for the order summary
 * @returns Buffer containing the PDF data
 */
const renderOrderSummaryPDF = async (props: OrderSummaryPDFTemplateProps): Promise<Buffer> => {
  const pdfDocument = pdf(<OrderSummaryPDFTemplate {...props} />);
  const stream = await pdfDocument.toBuffer();

  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Uint8Array);
  }

  return Buffer.concat(chunks);
};

export default renderOrderSummaryPDF;
