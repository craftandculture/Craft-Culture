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
    padding: 40,
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
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#a3a3a3',
    borderTop: '1px solid #e5e5e5',
    paddingTop: 12,
  },
  footerText: {
    marginBottom: 3,
    lineHeight: 1.4,
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
}

/**
 * PDF template for quote documents
 */
const QuotePDFTemplate = ({
  quote,
  lineItems,
  user,
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
              const pricePerBottle = item.bottlesPerCase > 0
                ? item.pricePerCase / item.bottlesPerCase
                : 0;

              return (
                <View
                  key={index}
                  style={index % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
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
          <Text style={styles.footerText}>
            Craft & Culture Index — Transparent pricing and trade intelligence for fine wine &
            spirits across the Middle East.
          </Text>
          <Text style={styles.footerText}>
            All prices are subject to final confirmation and availability at the time of order.
          </Text>
          <Text style={styles.footerText}>
            © Craft & Culture FZE. All rights reserved. www.craftculture.xyz
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default QuotePDFTemplate;
