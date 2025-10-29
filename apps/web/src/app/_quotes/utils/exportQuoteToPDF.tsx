import { pdf } from '@react-pdf/renderer';

import type { Quote } from '@/database/schema';

import QuotePDFTemplate, { type QuotePDFTemplateProps } from '../components/QuotePDFTemplate';

/**
 * Export a quote to PDF and trigger download
 *
 * @param quote - The quote to export
 * @param lineItems - Product line items with pricing
 * @param user - User/company information for branding
 * @param leadTimeMin - Minimum lead time in days
 * @param leadTimeMax - Maximum lead time in days
 */
const exportQuoteToPDF = async (
  quote: Quote,
  lineItems: Array<{
    productName: string;
    producer?: string | null;
    region?: string | null;
    year?: string | null;
    quantity: number;
    pricePerCase: number;
    lineTotal: number;
  }>,
  user: {
    companyName?: string | null;
    companyLogo?: string | null;
  },
  leadTimeMin: number,
  leadTimeMax: number,
) => {
  const props: QuotePDFTemplateProps = {
    quote: {
      name: quote.name,
      quoteNumber: undefined, // TODO: Add quote numbering system
      createdAt: new Date(quote.createdAt),
      validUntil: undefined, // TODO: Add validity period
      clientName: quote.clientName,
      clientEmail: quote.clientEmail,
      clientCompany: quote.clientCompany,
      currency: quote.currency,
      totalUsd: quote.totalUsd,
      totalAed: quote.totalAed,
      notes: quote.notes,
    },
    lineItems,
    user,
    leadTimeMin,
    leadTimeMax,
  };

  // Generate PDF blob
  const blob = await pdf(<QuotePDFTemplate {...props} />).toBlob();

  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  // Generate filename: Quote-{ClientName}-{Date}.pdf
  const clientName = quote.clientCompany || quote.clientName || 'Quote';
  const date = new Date(quote.createdAt).toISOString().split('T')[0]; // YYYY-MM-DD
  const sanitizedClientName = clientName.replace(/[^a-zA-Z0-9-]/g, '_');
  link.download = `Quote-${sanitizedClientName}-${date}.pdf`;

  // Trigger download
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Cleanup
  URL.revokeObjectURL(url);
};

export default exportQuoteToPDF;
