import { pdf } from '@react-pdf/renderer';

import InboundDeliveryNotePDFTemplate from '../components/InboundDeliveryNotePDFTemplate';
import type { InboundDeliveryNotePDFTemplateProps } from '../components/InboundDeliveryNotePDFTemplate';

/**
 * Render an inbound delivery note to a Buffer for storage or email.
 *
 * @example
 *   const buf = await renderInboundDeliveryNotePDF({ deliveryNote, shipment, items });
 *
 * @param props - Delivery note, shipment and received lines
 * @returns Buffer containing the PDF
 */
const renderInboundDeliveryNotePDF = async (
  props: InboundDeliveryNotePDFTemplateProps,
): Promise<Buffer> => {
  const pdfDocument = pdf(<InboundDeliveryNotePDFTemplate {...props} />);
  const stream = await pdfDocument.toBuffer();
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Uint8Array);
  }
  return Buffer.concat(chunks);
};

export default renderInboundDeliveryNotePDF;
