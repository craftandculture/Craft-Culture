'use client';

import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

import formatLwin18, { formatCaseConfig } from '../utils/formatLwin18';

// Register fonts
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

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingHorizontal: 40,
    paddingBottom: 80,
    fontFamily: 'Roboto',
    fontSize: 10,
    color: '#0a0a0a',
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottom: '2px solid #6BBFBF',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  companyName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#6BBFBF',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0a0a0a',
    marginBottom: 12,
    letterSpacing: 1,
  },
  rfqInfo: {
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
  alternativeBadge: {
    fontSize: 7,
    color: '#b45309',
    backgroundColor: '#fef3c7',
    padding: 2,
    marginTop: 2,
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
  unquotedSection: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#fef2f2',
    borderRadius: 4,
    borderLeft: '3px solid #ef4444',
  },
  unquotedTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#b91c1c',
    marginBottom: 8,
  },
  unquotedItem: {
    fontSize: 9,
    color: '#0a0a0a',
    marginBottom: 4,
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

export interface RfqPDFTemplateProps {
  rfq: {
    rfqNumber: string;
    name: string;
    distributorName?: string | null;
    distributorEmail?: string | null;
    distributorCompany?: string | null;
    distributorNotes?: string | null;
    generatedAt: Date;
  };
  lineItems: Array<{
    productName: string;
    producer?: string | null;
    vintage?: string | null;
    region?: string | null;
    bottleSize?: string | null;
    caseConfig?: string | number | null;
    lwin?: string | null;
    quantity: number;
    pricePerCase: number;
    lineTotal: number;
    isAlternative: boolean;
    alternativeReason?: string | null;
    leadTimeDays?: number | null;
    stockLocation?: string | null;
    supplierName?: string | null;
  }>;
  summary: {
    totalItems: number;
    quotedItems: number;
    unquotedItems: number;
    totalCostUsd: number;
    totalFinalUsd: number;
    margin: number;
  };
  unquotedItems: Array<{
    productName: string | null;
    producer?: string | null;
    vintage?: string | null;
    quantity?: number | null;
  }>;
}

/**
 * PDF template for SOURCE RFQ quotes
 */
const RfqPDFTemplate = ({
  rfq,
  lineItems,
  summary,
  unquotedItems,
}: RfqPDFTemplateProps) => {
  const formatPrice = (amount: number) => {
    return `USD ${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.companyName}>Craft & Culture</Text>
            <Text style={{ fontSize: 8, color: '#737373', marginTop: 4 }}>
              Wine & Spirits Sourcing
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.title}>QUOTATION</Text>
            <Text style={styles.rfqInfo}>RFQ #: {rfq.rfqNumber}</Text>
            <Text style={styles.rfqInfo}>Date: {formatDate(rfq.generatedAt)}</Text>
            <Text style={styles.rfqInfo}>
              Valid: 7 days from issue
            </Text>
          </View>
        </View>

        {/* Customer Information */}
        {(rfq.distributorCompany || rfq.distributorName || rfq.distributorEmail) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quote For</Text>
            <View style={styles.customerBox}>
              {rfq.distributorCompany && (
                <Text style={styles.customerText}>
                  <Text style={styles.customerLabel}>Company: </Text>
                  {rfq.distributorCompany}
                </Text>
              )}
              {rfq.distributorName && (
                <Text style={styles.customerText}>
                  <Text style={styles.customerLabel}>Contact: </Text>
                  {rfq.distributorName}
                </Text>
              )}
              {rfq.distributorEmail && (
                <Text style={styles.customerText}>
                  <Text style={styles.customerLabel}>Email: </Text>
                  {rfq.distributorEmail}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Line Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Line Items ({summary.quotedItems} of {summary.totalItems})
          </Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.colProduct}>Product</Text>
              <Text style={styles.colQuantity}>Qty</Text>
              <Text style={styles.colPrice}>Per Case</Text>
              <Text style={styles.colTotal}>Total</Text>
            </View>

            {lineItems.map((item, index) => {
              // Generate LWIN-18 and case config display
              const lwin18 = formatLwin18({
                lwin: item.lwin,
                vintage: item.vintage,
                bottleSize: item.bottleSize,
                caseConfig: item.caseConfig,
              });
              const caseConfigDisplay = formatCaseConfig({
                caseConfig: item.caseConfig,
                bottleSize: item.bottleSize,
              });

              return (
                <View
                  key={index}
                  style={index % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
                  wrap={false}
                >
                  <View style={styles.colProduct}>
                    <Text style={styles.productName}>{item.productName}</Text>
                    <Text style={styles.productMeta}>
                      {[item.producer, item.region, item.vintage].filter(Boolean).join(' • ')}
                    </Text>
                    {(lwin18 || caseConfigDisplay) && (
                      <Text style={styles.productMeta}>
                        {[lwin18, caseConfigDisplay].filter(Boolean).join(' | ')}
                      </Text>
                    )}
                    {item.isAlternative && (
                      <Text style={styles.alternativeBadge}>
                        ALTERNATIVE
                        {item.alternativeReason && `: ${item.alternativeReason}`}
                      </Text>
                    )}
                    {item.leadTimeDays && (
                      <Text style={styles.productMeta}>{item.leadTimeDays} days lead time</Text>
                    )}
                  </View>
                  <Text style={styles.colQuantity}>
                    {item.quantity} {item.quantity === 1 ? 'cs' : 'cs'}
                  </Text>
                  <Text style={styles.colPrice}>{formatPrice(item.pricePerCase)}</Text>
                  <Text style={styles.colTotal}>{formatPrice(item.lineTotal)}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Pricing Summary */}
        <View style={styles.pricingSection}>
          <View style={[styles.pricingRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total:</Text>
            <Text style={styles.totalValue}>{formatPrice(summary.totalFinalUsd)}</Text>
          </View>
        </View>

        {/* Unquoted Items */}
        {unquotedItems.length > 0 && (
          <View style={styles.unquotedSection}>
            <Text style={styles.unquotedTitle}>
              Unable to Quote ({unquotedItems.length} items)
            </Text>
            {unquotedItems.map((item, index) => (
              <Text key={index} style={styles.unquotedItem}>
                • {item.productName}
                {item.vintage ? ` (${item.vintage})` : ''}
                {item.quantity ? ` - ${item.quantity} cases` : ''}
              </Text>
            ))}
          </View>
        )}

        {/* Notes */}
        {rfq.distributorNotes && (
          <View style={styles.notesBox}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{rfq.distributorNotes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <View style={styles.footerContent}>
            <View>
              <Text style={{ fontSize: 8, color: '#737373' }}>
                Craft & Culture FZE
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.footerBranding}>
                Powered by <Text style={styles.footerBrandingBold}>C&C Index</Text>
              </Text>
              <Text style={styles.footerBranding}>craftculture.xyz</Text>
            </View>
          </View>
          <Text style={styles.footerDisclaimer}>
            All prices subject to confirmation and availability. Prices quoted in USD, In Bond UAE.
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default RfqPDFTemplate;
