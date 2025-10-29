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

// PDF Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Roboto',
    fontSize: 10,
    color: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 30,
  },
  logo: {
    width: 120,
    height: 60,
    objectFit: 'contain',
  },
  companyNameFallback: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0066cc',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0066cc',
    marginBottom: 8,
  },
  quoteInfo: {
    fontSize: 9,
    color: '#666',
    marginBottom: 2,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  customerBox: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 4,
  },
  customerText: {
    fontSize: 9,
    marginBottom: 4,
    lineHeight: 1.4,
  },
  customerLabel: {
    fontWeight: 'bold',
    color: '#666',
  },
  table: {
    width: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0066cc',
    color: '#fff',
    padding: 8,
    fontWeight: 'bold',
    fontSize: 9,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #e0e0e0',
    padding: 8,
    fontSize: 9,
  },
  tableRowAlt: {
    backgroundColor: '#f9f9f9',
  },
  colProduct: {
    flex: 3,
  },
  colQuantity: {
    flex: 1,
    textAlign: 'center',
  },
  colPrice: {
    flex: 1.5,
    textAlign: 'right',
  },
  colTotal: {
    flex: 1.5,
    textAlign: 'right',
  },
  productName: {
    fontWeight: 'bold',
    marginBottom: 2,
  },
  productMeta: {
    fontSize: 8,
    color: '#666',
  },
  pricingSection: {
    marginTop: 20,
    alignItems: 'flex-end',
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 200,
    paddingVertical: 4,
    fontSize: 10,
  },
  pricingLabel: {
    color: '#666',
  },
  pricingValue: {
    fontWeight: 'bold',
  },
  totalRow: {
    borderTop: '2px solid #0066cc',
    paddingTop: 8,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0066cc',
  },
  notesBox: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 4,
    marginTop: 20,
  },
  notesText: {
    fontSize: 9,
    lineHeight: 1.4,
    color: '#333',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#999',
    borderTop: '1px solid #e0e0e0',
    paddingTop: 10,
  },
  footerText: {
    marginBottom: 2,
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
    pricePerCase: number;
    lineTotal: number;
  }>;
  user: {
    companyName?: string | null;
    companyLogo?: string | null;
  };
  leadTimeMin: number;
  leadTimeMax: number;
}

/**
 * PDF template for quote documents
 */
const QuotePDFTemplate = ({
  quote,
  lineItems,
  user,
  leadTimeMin,
  leadTimeMax,
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
          <View>
            {user.companyLogo ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image doesn't support alt prop
              <Image src={user.companyLogo} style={styles.logo} />
            ) : user.companyName ? (
              <Text style={styles.companyNameFallback}>{user.companyName}</Text>
            ) : (
              <Text style={styles.companyNameFallback}>Wine Quotation</Text>
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.title}>QUOTATION</Text>
            {quote.quoteNumber && (
              <Text style={styles.quoteInfo}>Quote #: {quote.quoteNumber}</Text>
            )}
            <Text style={styles.quoteInfo}>Date: {formatDate(quote.createdAt)}</Text>
            <Text style={styles.quoteInfo}>Valid Until: {formatDate(validUntil)}</Text>
            <Text style={styles.quoteInfo}>
              Lead Time: {leadTimeMin}-{leadTimeMax} days
            </Text>
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
              <Text style={styles.colPrice}>Price/Case</Text>
              <Text style={styles.colTotal}>Total</Text>
            </View>

            {/* Table Rows */}
            {lineItems.map((item, index) => (
              <View
                key={index}
                style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt]}
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
                <Text style={styles.colPrice}>
                  {formatPrice(item.pricePerCase, quote.currency)}
                </Text>
                <Text style={styles.colTotal}>
                  {formatPrice(item.lineTotal, quote.currency)}
                </Text>
              </View>
            ))}
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

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Terms: EX-Works UAE (In-Bond)</Text>
          <Text style={styles.footerText}>
            Lead Time: {leadTimeMin}-{leadTimeMax} days via air freight
          </Text>
          <Text style={styles.footerText}>Powered by Craft & Culture</Text>
          <Text style={styles.footerText}>www.craftandculture.com</Text>
        </View>
      </Page>
    </Document>
  );
};

export default QuotePDFTemplate;
