import { Document, Font, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

// Register fonts (using default fonts for now, can be customized)
Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Me5WZLCzYlKw.ttf' },
    {
      src: 'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlvAx05IsDqlA.ttf',
      fontWeight: 'bold',
    },
  ],
});

// PDF Styles - Matching Craft & Culture Index brand colors
const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingHorizontal: 40,
    paddingBottom: 80, // Reserve space for footer
    fontFamily: 'Roboto',
    fontSize: 10,
    color: '#0a0a0a',
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 40,
    paddingBottom: 20,
    borderBottom: '2px solid #6BBFBF',
  },
  logo: {
    width: 168,
    height: 84,
    objectFit: 'contain',
  },
  companyNameFallback: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#6BBFBF',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  companyInfo: {
    fontSize: 8,
    color: '#737373',
    lineHeight: 1.4,
    marginTop: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0a0a0a',
    marginBottom: 12,
    letterSpacing: 1,
  },
  quoteInfo: {
    fontSize: 9,
    color: '#737373',
    marginBottom: 3,
    lineHeight: 1.3,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#0a0a0a',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingBottom: 4,
    borderBottom: '1px solid #e5e5e5',
  },
  customerBox: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 4,
    borderLeft: '3px solid #6BBFBF',
  },
  customerText: {
    fontSize: 9,
    marginBottom: 5,
    lineHeight: 1.5,
    color: '#0a0a0a',
  },
  customerLabel: {
    fontWeight: 'bold',
    color: '#737373',
  },
  table: {
    width: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#6BBFBF',
    color: '#ffffff',
    padding: 10,
    fontWeight: 'bold',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #e5e5e5',
    padding: 10,
    fontSize: 9,
  },
  tableRowAlt: {
    backgroundColor: '#fafafa',
  },
  colProduct: {
    flex: 3,
  },
  colQuantity: {
    flex: 1,
    textAlign: 'center',
  },
  colBottlePrice: {
    flex: 1.2,
    textAlign: 'right',
  },
  colPrice: {
    flex: 1.3,
    textAlign: 'right',
  },
  colTotal: {
    flex: 1.3,
    textAlign: 'right',
  },
  productName: {
    fontWeight: 'bold',
    marginBottom: 3,
    color: '#0a0a0a',
  },
  productMeta: {
    fontSize: 8,
    color: '#737373',
    lineHeight: 1.3,
  },
  pricingSection: {
    marginTop: 24,
    alignItems: 'flex-end',
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 220,
    paddingVertical: 5,
    fontSize: 10,
  },
  pricingLabel: {
    color: '#737373',
  },
  pricingValue: {
    fontWeight: 'bold',
    color: '#0a0a0a',
  },
  totalRow: {
    borderTop: '2px solid #6BBFBF',
    paddingTop: 10,
    marginTop: 6,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0a0a0a',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6BBFBF',
  },
  notesBox: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 4,
    marginTop: 24,
    borderLeft: '3px solid #6BBFBF',
  },
  notesText: {
    fontSize: 9,
    lineHeight: 1.6,
    color: '#0a0a0a',
  },
  supplierSection: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f0fdf4',
    borderRadius: 4,
    borderLeft: '3px solid #22c55e',
  },
  supplierHeader: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#166534',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  supplierLogo: {
    width: 100,
    height: 50,
    objectFit: 'contain',
    marginBottom: 8,
  },
  supplierName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#166534',
    marginBottom: 4,
  },
  supplierDetails: {
    fontSize: 8,
    color: '#4b5563',
    lineHeight: 1.4,
  },
  specialOrderSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTop: '1px dashed #e5e5e5',
  },
  specialOrderTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#166534',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bankDetailsSection: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    borderLeft: '3px solid #6BBFBF',
  },
  bankDetailsHeader: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#0a0a0a',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bankDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  bankDetailsRow: {
    flexDirection: 'row',
    width: '50%',
    marginBottom: 6,
  },
  bankDetailsRowFull: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 6,
  },
  bankDetailsLabel: {
    fontSize: 8,
    color: '#737373',
    width: 70,
  },
  bankDetailsValue: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#0a0a0a',
    flex: 1,
  },
  bankDetailsReference: {
    marginTop: 10,
    paddingTop: 8,
    borderTop: '1px solid #e5e5e5',
    backgroundColor: '#e8f5f5',
    padding: 10,
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bankDetailsRefLabel: {
    fontSize: 8,
    color: '#737373',
  },
  bankDetailsRefValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#6BBFBF',
    fontFamily: 'Courier',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    borderTop: '1px solid #e5e5e5',
    paddingTop: 10,
  },
  footerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  footerLeft: {
    flex: 1,
  },
  footerRight: {
    alignItems: 'flex-end',
  },
  footerPartnerName: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0a0a0a',
    marginBottom: 2,
  },
  footerPartnerContact: {
    fontSize: 7,
    color: '#737373',
    lineHeight: 1.3,
  },
  footerBranding: {
    fontSize: 7,
    color: '#a3a3a3',
    textAlign: 'right',
  },
  footerBrandingBold: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#6BBFBF',
  },
  footerDisclaimer: {
    fontSize: 6,
    color: '#a3a3a3',
    marginTop: 6,
    textAlign: 'center',
  },
});

export interface QuotePDFTemplateProps {
  quote: {
    name: string;
    quoteNumber?: string;
    createdAt: Date;
    validUntil?: Date;
    clientName?: string | null;
    clientEmail?: string | null;
    clientCompany?: string | null;
    currency: string;
    totalUsd: number;
    totalAed?: number | null;
    notes?: string | null;
  };
  lineItems: Array<{
    productName: string;
    producer?: string | null;
    region?: string | null;
    year?: string | null;
    quantity: number;
    bottlesPerCase: number;
    pricePerCase: number;
    lineTotal: number;
  }>;
  user: {
    companyName?: string | null;
    companyLogo?: string | null;
    companyAddress?: string | null;
    companyPhone?: string | null;
    companyEmail?: string | null;
    companyWebsite?: string | null;
    companyVatNumber?: string | null;
  };
  /** Fulfilled out-of-catalogue items with pricing */
  fulfilledOocItems?: Array<{
    productName: string;
    vintage?: string;
    quantity: number;
    pricePerCase: number;
    lineTotal: number;
  }>;
  /** Licensed partner/distributor info for B2C quotes */
  licensedPartner?: {
    businessName: string;
    businessAddress?: string | null;
    businessPhone?: string | null;
    businessEmail?: string | null;
    logoUrl?: string | null;
  } | null;
  /** Bank transfer payment details */
  paymentDetails?: {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    sortCode?: string;
    iban?: string;
    swiftBic?: string;
    reference?: string;
  };
}

/**
 * PDF template for quote documents
 */
const QuotePDFTemplate = ({
  quote,
  lineItems,
  user,
  fulfilledOocItems,
  licensedPartner,
  paymentDetails,
}: QuotePDFTemplateProps) => {
  const formatPrice = (amount: number, currency: string) => {
    return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const total =
    quote.currency === 'AED' ? quote.totalAed ?? quote.totalUsd : quote.totalUsd;
  const validUntil = quote.validUntil || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ maxWidth: '60%' }}>
            {user.companyLogo ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image doesn't support alt prop
              <Image src={user.companyLogo} style={styles.logo} />
            ) : user.companyName ? (
              <Text style={styles.companyNameFallback}>{user.companyName}</Text>
            ) : (
              <Text style={styles.companyNameFallback}>Wine Quotation</Text>
            )}

            {/* Company Information */}
            {(user.companyAddress || user.companyPhone || user.companyEmail || user.companyWebsite || user.companyVatNumber) && (
              <View style={styles.companyInfo}>
                {user.companyAddress && <Text>{user.companyAddress}</Text>}
                {user.companyPhone && <Text>Tel: {user.companyPhone}</Text>}
                {user.companyEmail && <Text>Email: {user.companyEmail}</Text>}
                {user.companyWebsite && <Text>{user.companyWebsite}</Text>}
                {user.companyVatNumber && <Text>VAT: {user.companyVatNumber}</Text>}
              </View>
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.title}>QUOTATION</Text>
            {quote.quoteNumber && (
              <Text style={styles.quoteInfo}>Quote #: {quote.quoteNumber}</Text>
            )}
            <Text style={styles.quoteInfo}>Date: {formatDate(quote.createdAt)}</Text>
            <Text style={styles.quoteInfo}>Valid Until: {formatDate(validUntil)}</Text>
          </View>
        </View>

        {/* Customer Information */}
        {(quote.clientName || quote.clientEmail || quote.clientCompany) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customer Information</Text>
            <View style={styles.customerBox}>
              {quote.clientCompany && (
                <Text style={styles.customerText}>
                  <Text style={styles.customerLabel}>Company: </Text>
                  {quote.clientCompany}
                </Text>
              )}
              {quote.clientName && (
                <Text style={styles.customerText}>
                  <Text style={styles.customerLabel}>Contact: </Text>
                  {quote.clientName}
                </Text>
              )}
              {quote.clientEmail && (
                <Text style={styles.customerText}>
                  <Text style={styles.customerLabel}>Email: </Text>
                  {quote.clientEmail}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Line Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Line Items</Text>
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={styles.colProduct}>Product</Text>
              <Text style={styles.colQuantity}>Qty</Text>
              <Text style={styles.colBottlePrice}>Per Btl</Text>
              <Text style={styles.colPrice}>Per Case</Text>
              <Text style={styles.colTotal}>Total</Text>
            </View>

            {/* Table Rows */}
            {lineItems.map((item, index) => {
              const pricePerBottle =
                item.bottlesPerCase > 0 ? item.pricePerCase / item.bottlesPerCase : 0;

              return (
                <View
                  key={index}
                  style={index % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
                  wrap={false}
                >
                  <View style={styles.colProduct}>
                    <Text style={styles.productName}>{item.productName}</Text>
                    <Text style={styles.productMeta}>
                      {[item.producer, item.region, item.year].filter(Boolean).join(' • ')}
                    </Text>
                  </View>
                  <Text style={styles.colQuantity}>
                    {item.quantity} {item.quantity === 1 ? 'case' : 'cases'}
                  </Text>
                  <Text style={styles.colBottlePrice}>
                    {formatPrice(pricePerBottle, quote.currency)}
                  </Text>
                  <Text style={styles.colPrice}>
                    {formatPrice(item.pricePerCase, quote.currency)}
                  </Text>
                  <Text style={styles.colTotal}>
                    {formatPrice(item.lineTotal, quote.currency)}
                  </Text>
                </View>
              );
            })}

            {/* Special Order Items (fulfilled OOC items) */}
            {fulfilledOocItems && fulfilledOocItems.length > 0 && (
              <View style={styles.specialOrderSection}>
                <Text style={styles.specialOrderTitle}>Special Order Items</Text>
                {fulfilledOocItems.map((item, index) => (
                  <View
                    key={`ooc-${index}`}
                    style={index % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
                    wrap={false}
                  >
                    <View style={styles.colProduct}>
                      <Text style={styles.productName}>{item.productName}</Text>
                      {item.vintage && (
                        <Text style={styles.productMeta}>Vintage: {item.vintage}</Text>
                      )}
                    </View>
                    <Text style={styles.colQuantity}>
                      {item.quantity} {item.quantity === 1 ? 'case' : 'cases'}
                    </Text>
                    <Text style={styles.colBottlePrice}>-</Text>
                    <Text style={styles.colPrice}>
                      {formatPrice(item.pricePerCase, quote.currency)}
                    </Text>
                    <Text style={styles.colTotal}>
                      {formatPrice(item.lineTotal, quote.currency)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Pricing Summary */}
        <View style={styles.pricingSection}>
          <View style={[styles.pricingRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total:</Text>
            <Text style={styles.totalValue}>{formatPrice(total, quote.currency)}</Text>
          </View>
        </View>

        {/* Notes */}
        {quote.notes && (
          <View style={styles.notesBox}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{quote.notes}</Text>
          </View>
        )}

        {/* Licensed Partner / Supplier Information - Only show if logo or address provided */}
        {licensedPartner && (licensedPartner.logoUrl || licensedPartner.businessAddress) && (
          <View style={styles.supplierSection} wrap={false}>
            <Text style={styles.supplierHeader}>SUPPLIED BY</Text>
            {licensedPartner.logoUrl && (
              // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image doesn't support alt prop
              <Image src={licensedPartner.logoUrl} style={styles.supplierLogo} />
            )}
            <Text style={styles.supplierName}>{licensedPartner.businessName}</Text>
            {licensedPartner.businessAddress && (
              <View style={styles.supplierDetails}>
                <Text>{licensedPartner.businessAddress}</Text>
              </View>
            )}
          </View>
        )}

        {/* Bank Transfer Payment Details */}
        {paymentDetails && (paymentDetails.bankName || paymentDetails.iban || paymentDetails.accountNumber) && (
          <View style={styles.bankDetailsSection} wrap={false}>
            <Text style={styles.bankDetailsHeader}>Payment Details (Bank Transfer)</Text>
            <View style={styles.bankDetailsGrid}>
              {paymentDetails.bankName && (
                <View style={styles.bankDetailsRow}>
                  <Text style={styles.bankDetailsLabel}>Bank:</Text>
                  <Text style={styles.bankDetailsValue}>{paymentDetails.bankName}</Text>
                </View>
              )}
              {paymentDetails.accountName && (
                <View style={styles.bankDetailsRow}>
                  <Text style={styles.bankDetailsLabel}>Account:</Text>
                  <Text style={styles.bankDetailsValue}>{paymentDetails.accountName}</Text>
                </View>
              )}
              {paymentDetails.accountNumber && (
                <View style={styles.bankDetailsRow}>
                  <Text style={styles.bankDetailsLabel}>Account No:</Text>
                  <Text style={styles.bankDetailsValue}>{paymentDetails.accountNumber}</Text>
                </View>
              )}
              {paymentDetails.sortCode && (
                <View style={styles.bankDetailsRow}>
                  <Text style={styles.bankDetailsLabel}>Sort Code:</Text>
                  <Text style={styles.bankDetailsValue}>{paymentDetails.sortCode}</Text>
                </View>
              )}
              {paymentDetails.iban && (
                <View style={styles.bankDetailsRowFull}>
                  <Text style={styles.bankDetailsLabel}>IBAN:</Text>
                  <Text style={styles.bankDetailsValue}>{paymentDetails.iban}</Text>
                </View>
              )}
              {paymentDetails.swiftBic && (
                <View style={styles.bankDetailsRow}>
                  <Text style={styles.bankDetailsLabel}>SWIFT/BIC:</Text>
                  <Text style={styles.bankDetailsValue}>{paymentDetails.swiftBic}</Text>
                </View>
              )}
            </View>
            {paymentDetails.reference && (
              <View style={styles.bankDetailsReference}>
                <Text style={styles.bankDetailsRefLabel}>Payment Reference:</Text>
                <Text style={styles.bankDetailsRefValue}>{paymentDetails.reference}</Text>
              </View>
            )}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <View style={styles.footerContent}>
            {/* Left: Licensed Partner Info (if available) */}
            <View style={styles.footerLeft}>
              {licensedPartner ? (
                <>
                  <Text style={styles.footerPartnerName}>{licensedPartner.businessName}</Text>
                  <View style={styles.footerPartnerContact}>
                    {licensedPartner.businessPhone && (
                      <Text>{licensedPartner.businessPhone}</Text>
                    )}
                    {licensedPartner.businessEmail && (
                      <Text>{licensedPartner.businessEmail}</Text>
                    )}
                  </View>
                </>
              ) : user.companyName ? (
                <>
                  <Text style={styles.footerPartnerName}>{user.companyName}</Text>
                  <View style={styles.footerPartnerContact}>
                    {user.companyPhone && <Text>{user.companyPhone}</Text>}
                    {user.companyEmail && <Text>{user.companyEmail}</Text>}
                  </View>
                </>
              ) : null}
            </View>

            {/* Right: C&C Branding */}
            <View style={styles.footerRight}>
              <Text style={styles.footerBranding}>
                Powered by <Text style={styles.footerBrandingBold}>C&C Index</Text>
              </Text>
              <Text style={styles.footerBranding}>craftculture.xyz</Text>
            </View>
          </View>

          <Text style={styles.footerDisclaimer}>
            All prices subject to confirmation and availability. © Craft & Culture FZE
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default QuotePDFTemplate;
