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
    marginBottom: 30,
    paddingBottom: 16,
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
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0a0a0a',
    marginBottom: 8,
    letterSpacing: 1,
  },
  docInfo: {
    fontSize: 9,
    color: '#737373',
    marginBottom: 3,
    lineHeight: 1.3,
  },
  orderSection: {
    marginBottom: 20,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 4,
    borderLeft: '3px solid #6BBFBF',
    marginBottom: 8,
  },
  orderNumber: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0a0a0a',
  },
  orderMeta: {
    fontSize: 8,
    color: '#737373',
  },
  orderClient: {
    fontSize: 9,
    color: '#737373',
  },
  table: {
    width: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#6BBFBF',
    color: '#ffffff',
    padding: 8,
    fontWeight: 'bold',
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #e5e5e5',
    padding: 8,
    fontSize: 8,
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
    marginBottom: 2,
    color: '#0a0a0a',
  },
  productMeta: {
    fontSize: 7,
    color: '#737373',
    lineHeight: 1.3,
  },
  priceUsd: {
    fontSize: 6,
    color: '#737373',
    marginTop: 1,
  },
  orderSubtotal: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#f9fafb',
    borderBottom: '1px solid #d4d4d4',
  },
  subtotalLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#737373',
    marginRight: 12,
  },
  subtotalValue: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#0a0a0a',
    textAlign: 'right',
  },
  grandTotalSection: {
    marginTop: 20,
    alignItems: 'flex-end',
  },
  grandTotalBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    padding: 16,
    minWidth: 200,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  grandTotalLabel: {
    fontSize: 9,
    color: '#737373',
  },
  grandTotalValue: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#0a0a0a',
    textAlign: 'right',
  },
  totalRow: {
    borderTop: '1px solid #d4d4d4',
    paddingTop: 8,
    marginTop: 4,
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0a0a0a',
  },
  totalValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#6BBFBF',
    textAlign: 'right',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1px solid #e5e5e5',
    paddingTop: 12,
  },
  footerText: {
    fontSize: 7,
    color: '#a3a3a3',
  },
});

interface OrderLineItem {
  productName: string;
  producer: string | null;
  vintage: string | null;
  region: string | null;
  bottleSize: string | null;
  quantity: number;
  distributorCostPerCaseUsd: number;
  pricePerCaseUsd: number;
  totalUsd: number;
}

interface OrderData {
  orderNumber: string;
  clientName: string;
  clientPhone: string | null;
  createdAt: Date;
  totalUsd: number;
  usdToAedRate: number;
  lineItems: OrderLineItem[];
}

export interface OrderSummaryPDFTemplateProps {
  distributorName: string;
  orders: OrderData[];
}

/**
 * PDF template for multi-order summary export
 *
 * Generates a combined document with line items for multiple PCO orders,
 * showing distributor cost and client price in both AED and USD.
 */
const OrderSummaryPDFTemplate = ({ distributorName, orders }: OrderSummaryPDFTemplateProps) => {
  const formatAed = (amountUsd: number, exchangeRate: number) => {
    const amountAed = amountUsd * exchangeRate;
    return `AED ${amountAed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatUsd = (amountUsd: number) => {
    return `$${amountUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Grand totals across all orders
  const grandTotalUsd = orders.reduce((sum, o) => sum + o.totalUsd, 0);
  // Use average exchange rate weighted by order total
  const weightedRate =
    grandTotalUsd > 0
      ? orders.reduce((sum, o) => sum + o.usdToAedRate * o.totalUsd, 0) / grandTotalUsd
      : 3.6725;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header} fixed>
          <View style={styles.headerLeft}>
            <Text style={styles.brandName}>Craft &amp; Culture</Text>
            <Text style={styles.brandTagline}>The bridge to the Middle East wine &amp; spirits market</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.title}>ORDER SUMMARY</Text>
            <Text style={styles.docInfo}>Date: {formatDate(new Date())}</Text>
            <Text style={styles.docInfo}>For: {distributorName}</Text>
            <Text style={styles.docInfo}>{orders.length} order{orders.length !== 1 ? 's' : ''} selected</Text>
          </View>
        </View>

        {/* Orders */}
        {orders.map((order, orderIndex) => (
          <View key={orderIndex} style={styles.orderSection} wrap={false}>
            {/* Order Header */}
            <View style={styles.orderHeader}>
              <View>
                <Text style={styles.orderNumber}>{order.orderNumber}</Text>
                <Text style={styles.orderClient}>
                  {order.clientName}
                  {order.clientPhone ? ` | ${order.clientPhone}` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.orderMeta}>{formatDate(order.createdAt)}</Text>
                <Text style={[styles.orderMeta, { fontWeight: 'bold', color: '#0a0a0a' }]}>
                  {formatAed(order.totalUsd, order.usdToAedRate)}
                </Text>
              </View>
            </View>

            {/* Line Items Table */}
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.colProduct}>Product</Text>
                <Text style={styles.colQuantity}>Qty</Text>
                <Text style={styles.colDistCost}>Dist. Cost/Case</Text>
                <Text style={styles.colDistTotal}>Dist. Total</Text>
                <Text style={styles.colClientPrice}>Client/Case</Text>
                <Text style={styles.colClientTotal}>Client Total</Text>
              </View>

              {order.lineItems.map((item, itemIndex) => {
                const distTotal = item.distributorCostPerCaseUsd * item.quantity;
                return (
                  <View
                    key={itemIndex}
                    style={itemIndex % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
                  >
                    <View style={styles.colProduct}>
                      <Text style={styles.productName}>{item.productName}</Text>
                      <Text style={styles.productMeta}>
                        {[item.producer, item.region, item.vintage, item.bottleSize]
                          .filter(Boolean)
                          .join(' \u2022 ')}
                      </Text>
                    </View>
                    <Text style={styles.colQuantity}>{item.quantity}</Text>
                    <Text style={styles.colDistCost}>
                      {formatAed(item.distributorCostPerCaseUsd, order.usdToAedRate)}
                      {'\n'}
                      <Text style={styles.priceUsd}>{formatUsd(item.distributorCostPerCaseUsd)}</Text>
                    </Text>
                    <Text style={styles.colDistTotal}>
                      {formatAed(distTotal, order.usdToAedRate)}
                      {'\n'}
                      <Text style={styles.priceUsd}>{formatUsd(distTotal)}</Text>
                    </Text>
                    <Text style={styles.colClientPrice}>
                      {formatAed(item.pricePerCaseUsd, order.usdToAedRate)}
                      {'\n'}
                      <Text style={styles.priceUsd}>{formatUsd(item.pricePerCaseUsd)}</Text>
                    </Text>
                    <Text style={styles.colClientTotal}>
                      {formatAed(item.totalUsd, order.usdToAedRate)}
                      {'\n'}
                      <Text style={styles.priceUsd}>{formatUsd(item.totalUsd)}</Text>
                    </Text>
                  </View>
                );
              })}

              {/* Order Subtotal */}
              <View style={styles.orderSubtotal}>
                <Text style={styles.subtotalLabel}>Order Total:</Text>
                <Text style={styles.subtotalValue}>
                  {formatAed(order.totalUsd, order.usdToAedRate)} ({formatUsd(order.totalUsd)})
                </Text>
              </View>
            </View>
          </View>
        ))}

        {/* Grand Total */}
        <View style={styles.grandTotalSection} wrap={false}>
          <View style={styles.grandTotalBox}>
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Orders:</Text>
              <Text style={styles.grandTotalValue}>{orders.length}</Text>
            </View>
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Total Cases:</Text>
              <Text style={styles.grandTotalValue}>
                {orders.reduce(
                  (sum, o) => sum + o.lineItems.reduce((s, li) => s + li.quantity, 0),
                  0,
                )}
              </Text>
            </View>
            <View style={[styles.grandTotalRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Grand Total:</Text>
              <Text style={styles.totalValue}>
                {formatAed(grandTotalUsd, weightedRate)}
                {'\n'}
                <Text style={{ fontSize: 9, color: '#737373' }}>{formatUsd(grandTotalUsd)}</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Craft &amp; Culture | Order Summary</Text>
          <Text style={styles.footerText}>Generated {formatDate(new Date())}</Text>
        </View>
      </Page>
    </Document>
  );
};

export default OrderSummaryPDFTemplate;
