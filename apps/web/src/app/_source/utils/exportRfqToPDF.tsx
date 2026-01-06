import { pdf } from '@react-pdf/renderer';

import RfqPDFTemplate, { type RfqPDFTemplateProps } from '../components/RfqPDFTemplate';

/**
 * Export a SOURCE RFQ quote to PDF and trigger download
 *
 * @example
 *   exportRfqToPDF(rfqData, lineItems, summary, unquotedItems);
 *
 * @param rfq - The RFQ metadata
 * @param lineItems - Selected line items with pricing
 * @param summary - Quote summary with totals
 * @param unquotedItems - Items that couldn't be quoted
 */
const exportRfqToPDF = async (
  rfq: RfqPDFTemplateProps['rfq'],
  lineItems: RfqPDFTemplateProps['lineItems'],
  summary: RfqPDFTemplateProps['summary'],
  unquotedItems: RfqPDFTemplateProps['unquotedItems'],
) => {
  const props: RfqPDFTemplateProps = {
    rfq,
    lineItems,
    summary,
    unquotedItems,
  };

  // Generate PDF blob
  const blob = await pdf(<RfqPDFTemplate {...props} />).toBlob();

  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  // Generate filename: SOURCE-{RFQNumber}-{Date}.pdf
  const date = new Date().toISOString().split('T')[0];
  const sanitizedNumber = rfq.rfqNumber.replace(/[^a-zA-Z0-9-]/g, '_');
  link.download = `SOURCE-${sanitizedNumber}-${date}.pdf`;

  // Trigger download
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Cleanup
  URL.revokeObjectURL(url);
};

export default exportRfqToPDF;
