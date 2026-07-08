import { pdf } from '@react-pdf/renderer';

import PickingListPDFTemplate from '../components/PickingListPDFTemplate';
import type { PickingListPDFTemplateProps } from '../components/PickingListPDFTemplate';

/**
 * Render a picking list PDF to a Buffer for streaming or storage
 *
 * @example
 *   const pdfBuffer = await renderPickingListPDF({
 *     pickListNumber: 'PL-001',
 *     orderRef: 'SO-1234',
 *     consignee: 'MMI',
 *     dispatchTo: 'RAK Port',
 *     date: new Date(),
 *     items: [...],
 *   });
 *
 * @param props - The data for the picking list
 * @returns Buffer containing the PDF data
 */
const renderPickingListPDF = async (props: PickingListPDFTemplateProps): Promise<Buffer> => {
  const pdfDocument = pdf(<PickingListPDFTemplate {...props} />);
  const stream = await pdfDocument.toBuffer();

  // toBuffer() returns a NodeJS.ReadableStream, convert to Buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Uint8Array);
  }

  return Buffer.concat(chunks);
};

export default renderPickingListPDF;
