import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

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

// PDF Styles - Matching Craft & Culture brand colors
const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingHorizontal: 40,
    paddingBottom: 100,
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
  headerLeft: {
    maxWidth: '50%',
  },
  brandName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#6BBFBF',
  },
  brandTagline: {
    fontSize: 8,
    color: '#737373',
    marginTop: 4,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0a0a0a',
    marginBottom: 12,
    letterSpacing: 1,
  },
  docInfo: {
    fontSize: 9,
    color: '#737373',
    marginBottom: 3,
    lineHeight: 1.3,
  },
  paymentRef: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#6BBFBF',
    marginTop: 6,
    backgroundColor: '#f0fafa',
    padding: 6,
    borderRadius: 4,
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
  infoBox: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 4,
    borderLeft: '3px solid #6BBFBF',
  },
  infoText: {
    fontSize: 9,
    marginBottom: 5,
    lineHeight: 1.5,
    color: '#0a0a0a',
  },
  infoLabel: {
    fontWeight: 'bold',
    color: '#737373',
  },
  twoColumn: {
    flexDirection: 'row',
    gap: 20,
  },
  column: {
    flex: 1,
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
    flex: 2.2,
  },
  colQuantity: {
    flex: 0.5,
    textAlign: 'center',
  },
  colDistCost: {
    flex: 1,
    textAlign: 'right',
  },
  colDistTotal: {
    flex: 1,
    textAlign: 'right',
  },
  colClientPrice: {
    flex: 1,
    textAlign: 'right',
  },
  colClientTotal: {
    flex: 1,
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
  priceUsd: {
    fontSize: 7,
    color: '#737373',
    marginTop: 1,
  },
  pricingSection: {
    marginTop: 24,
    alignItems: 'flex-end',
  },
  pricingBox: {
    width: 250,
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 4,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    fontSize: 9,
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
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0a0a0a',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6BBFBF',
  },
  partnerSection: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f0fdf4',
    borderRadius: 4,
    borderLeft: '3px solid #22c55e',
  },
  partnerHeader: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#166534',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  partnerName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#166534',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: '1px solid #e5e5e5',
    paddingTop: 10,
    backgroundColor: '#ffffff',
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
  footerText: {
    fontSize: 7,
    color: '#a3a3a3',
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
  actionRequired: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#fef3c7',
    borderRadius: 4,
    borderLeft: '4px solid #f59e0b',
  },
  actionRequiredHeader: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#92400e',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  actionRequiredText: {
    fontSize: 10,
    color: '#78350f',
    lineHeight: 1.6,
  },
  actionRequiredBold: {
    fontWeight: 'bold',
  },
});

export interface ProformaInvoicePDFTemplateProps {
  order: {
    orderNumber: string;
    createdAt: Date;
    paymentReference?: string | null;
    clientName: string;
    clientEmail?: string | null;
    clientPhone?: string | null;
    clientAddress?: string | null;
    deliveryNotes?: string | null;
    subtotalUsd?: number | null;
    dutyUsd?: number | null;
    vatUsd?: number | null;
    logisticsUsd?: number | null;
    totalUsd: number;
    usdToAedRate?: number;
  };
  lineItems: Array<{
    productName: string;
    producer?: string | null;
    vintage?: string | null;
    region?: string | null;
    bottleSize?: string | null;
    quantity: number;
    distributorCostPerCaseUsd?: number | null;
    pricePerCaseUsd?: number | null;
    totalUsd?: number | null;
  }>;
  partner?: {
    businessName: string;
    businessEmail?: string | null;
    businessPhone?: string | null;
  } | null;
  distributor: {
    businessName: string;
  };
}

/**
 * PDF template for distributor proforma invoices
 *
 * Generated when an order is assigned to a distributor.
 * Contains product details, pricing, and client information
 * for the distributor's finance team to raise an invoice.
 */
const ProformaInvoicePDFTemplate = ({
  order,
  lineItems,
  partner,
  distributor,
}: ProformaInvoicePDFTemplateProps) => {
  // Default exchange rate if not provided
  const exchangeRate = order.usdToAedRate ?? 3.6725;

  const formatAed = (amountUsd: number | null | undefined) => {
    if (amountUsd === null || amountUsd === undefined) return 'AED 0.00';
    const amountAed = amountUsd * exchangeRate;
    return `AED ${amountAed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatUsd = (amountUsd: number | null | undefined) => {
    if (amountUsd === null || amountUsd === undefined) return '$0.00';
    return `$${amountUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
            <Text style={styles.brandName}>Craft & Culture</Text>
            <Text style={styles.brandTagline}>The bridge to the Middle East wine & spirits market</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.title}>PROFORMA INVOICE</Text>
            <Text style={styles.docInfo}>Order #: {order.orderNumber}</Text>
            <Text style={styles.docInfo}>Date: {formatDate(order.createdAt)}</Text>
            <Text style={styles.docInfo}>For: {distributor.businessName}</Text>
            {order.paymentReference && (
              <Text style={styles.paymentRef}>Ref: {order.paymentReference}</Text>
            )}
          </View>
        </View>

        {/* Action Required Box */}
        <View style={styles.actionRequired}>
          <Text style={styles.actionRequiredHeader}>⚠ Action Required</Text>
          <Text style={styles.actionRequiredText}>
            Please issue an invoice to{' '}
            <Text style={styles.actionRequiredBold}>CD Private Client Team</Text>
            {' '}based on the details below. Once generated the Private Client team will upload the invoice to the C&C system.
          </Text>
        </View>

        {/* Client & Delivery Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client Information</Text>
          <View style={styles.twoColumn}>
            <View style={[styles.column, styles.infoBox]}>
              <Text style={styles.infoText}>
                <Text style={styles.infoLabel}>Client: </Text>
                {order.clientName}
              </Text>
              {order.clientEmail && (
                <Text style={styles.infoText}>
                  <Text style={styles.infoLabel}>Email: </Text>
                  {order.clientEmail}
                </Text>
              )}
              {order.clientPhone && (
                <Text style={styles.infoText}>
                  <Text style={styles.infoLabel}>Phone: </Text>
                  {order.clientPhone}
                </Text>
              )}
            </View>
            <View style={[styles.column, styles.infoBox]}>
              {order.clientAddress && (
                <Text style={styles.infoText}>
                  <Text style={styles.infoLabel}>Delivery Address: </Text>
                  {order.clientAddress}
                </Text>
              )}
              {order.deliveryNotes && (
                <Text style={styles.infoText}>
                  <Text style={styles.infoLabel}>Notes: </Text>
                  {order.deliveryNotes}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Line Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={styles.colProduct}>Product</Text>
              <Text style={styles.colQuantity}>Qty</Text>
              <Text style={styles.colDistCost}>Dist. Cost/Case</Text>
              <Text style={styles.colDistTotal}>Dist. Total</Text>
              <Text style={styles.colClientPrice}>Client/Case</Text>
              <Text style={styles.colClientTotal}>Client Total</Text>
            </View>

            {/* Table Rows */}
            {lineItems.map((item, index) => {
              const distTotal = (item.distributorCostPerCaseUsd ?? 0) * item.quantity;
              return (
                <View
                  key={index}
                  style={index % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
                  wrap={false}
                >
                  <View style={styles.colProduct}>
                    <Text style={styles.productName}>{item.productName}</Text>
                    <Text style={styles.productMeta}>
                      {[item.producer, item.region, item.vintage, item.bottleSize]
                        .filter(Boolean)
                        .join(' • ')}
                    </Text>
                  </View>
                  <Text style={styles.colQuantity}>{item.quantity}</Text>
                  <Text style={styles.colDistCost}>
                    {formatAed(item.distributorCostPerCaseUsd)}
                    {'\n'}
                    <Text style={styles.priceUsd}>{formatUsd(item.distributorCostPerCaseUsd)}</Text>
                  </Text>
                  <Text style={styles.colDistTotal}>
                    {formatAed(distTotal)}
                    {'\n'}
                    <Text style={styles.priceUsd}>{formatUsd(distTotal)}</Text>
                  </Text>
                  <Text style={styles.colClientPrice}>
                    {formatAed(item.pricePerCaseUsd)}
                    {'\n'}
                    <Text style={styles.priceUsd}>{formatUsd(item.pricePerCaseUsd)}</Text>
                  </Text>
                  <Text style={styles.colClientTotal}>
                    {formatAed(item.totalUsd)}
                    {'\n'}
                    <Text style={styles.priceUsd}>{formatUsd(item.totalUsd)}</Text>
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Pricing Summary */}
        <View style={styles.pricingSection} wrap={false}>
          <View style={styles.pricingBox}>
            {order.subtotalUsd !== null && order.subtotalUsd !== undefined && (
              <View style={styles.pricingRow}>
                <Text style={styles.pricingLabel}>Subtotal:</Text>
                <Text style={styles.pricingValue}>
                  {formatAed(order.subtotalUsd)}
                  {'\n'}
                  <Text style={{ fontSize: 8, color: '#737373' }}>{formatUsd(order.subtotalUsd)}</Text>
                </Text>
              </View>
            )}
            {order.dutyUsd !== null && order.dutyUsd !== undefined && order.dutyUsd > 0 && (
              <View style={styles.pricingRow}>
                <Text style={styles.pricingLabel}>Import Duty:</Text>
                <Text style={styles.pricingValue}>{formatAed(order.dutyUsd)}</Text>
              </View>
            )}
            {order.vatUsd !== null && order.vatUsd !== undefined && order.vatUsd > 0 && (
              <View style={styles.pricingRow}>
                <Text style={styles.pricingLabel}>VAT:</Text>
                <Text style={styles.pricingValue}>{formatAed(order.vatUsd)}</Text>
              </View>
            )}
            {order.logisticsUsd !== null && order.logisticsUsd !== undefined && order.logisticsUsd > 0 && (
              <View style={styles.pricingRow}>
                <Text style={styles.pricingLabel}>Logistics:</Text>
                <Text style={styles.pricingValue}>{formatAed(order.logisticsUsd)}</Text>
              </View>
            )}
            <View style={[styles.pricingRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalValue}>
                {formatAed(order.totalUsd)}
                {'\n'}
                <Text style={{ fontSize: 9, color: '#737373' }}>{formatUsd(order.totalUsd)}</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* Partner Information */}
        {partner && (
          <View style={styles.partnerSection} wrap={false}>
            <Text style={styles.partnerHeader}>Order Placed By</Text>
            <Text style={styles.partnerName}>{partner.businessName}</Text>
            {partner.businessEmail && (
              <Text style={styles.infoText}>{partner.businessEmail}</Text>
            )}
            {partner.businessPhone && (
              <Text style={styles.infoText}>{partner.businessPhone}</Text>
            )}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <View style={styles.footerContent}>
            <View style={styles.footerLeft}>
              <Text style={styles.footerText}>
                Proforma for invoice generation - Issue to CD Private Client Team
              </Text>
            </View>
            <View style={styles.footerRight}>
              <Text style={styles.footerText}>
                Generated by <Text style={styles.footerBrandingBold}>C&C Index</Text>
              </Text>
              <Text style={styles.footerText}>craftculture.xyz</Text>
            </View>
          </View>
          <Text style={styles.footerDisclaimer}>
            © Craft & Culture FZE - Private Client Orders
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default ProformaInvoicePDFTemplate;
