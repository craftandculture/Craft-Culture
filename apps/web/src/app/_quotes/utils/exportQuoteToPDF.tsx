import { pdf } from '@react-pdf/renderer';

import type { Quote } from '@/database/schema';

import QuotePDFTemplate, { type QuotePDFTemplateProps } from '../components/QuotePDFTemplate';

interface ExportOptions {
  /** Calculated total including OOC items (overrides quote.totalUsd) */
  calculatedTotalUsd?: number;
  /** Calculated AED total including OOC items (overrides quote.totalAed) */
  calculatedTotalAed?: number;
  /** Payment details for bank transfer */
  paymentDetails?: {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    sortCode?: string;
    iban?: string;
    swiftBic?: string;
    reference?: string;
  } | null;
}

/**
 * Export a quote to PDF and trigger download
 *
 * @param quote - The quote to export
 * @param lineItems - Product line items with pricing
 * @param user - User/company information for branding
 * @param fulfilledOocItems - Fulfilled out-of-catalogue items with pricing
 * @param licensedPartner - Licensed partner/distributor info for B2C quotes
 * @param options - Additional export options
 */
const exportQuoteToPDF = async (
  quote: Quote,
  lineItems: Array<{
    productName: string;
    producer?: string | null;
    region?: string | null;
    year?: string | null;
    quantity: number;
    bottlesPerCase: number;
    pricePerCase: number;
    lineTotal: number;
  }>,
  user: {
    companyName?: string | null;
    companyLogo?: string | null;
    companyAddress?: string | null;
    companyPhone?: string | null;
    companyEmail?: string | null;
    companyWebsite?: string | null;
    companyVatNumber?: string | null;
  },
  fulfilledOocItems?: Array<{
    productName: string;
    vintage?: string;
    quantity: number;
    pricePerCase: number;
    lineTotal: number;
  }>,
  licensedPartner?: {
    businessName: string;
    businessAddress?: string | null;
    businessPhone?: string | null;
    businessEmail?: string | null;
    logoUrl?: string | null;
  } | null,
  options?: ExportOptions,
) => {
  // Use calculated total if provided, otherwise fall back to quote total
  const totalUsd = options?.calculatedTotalUsd ?? quote.totalUsd;
  const totalAed = options?.calculatedTotalAed ?? quote.totalAed;

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
      totalUsd,
      totalAed,
      notes: quote.notes,
    },
    lineItems,
    user,
    fulfilledOocItems,
    licensedPartner: licensedPartner ?? undefined,
    paymentDetails: options?.paymentDetails ?? undefined,
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
