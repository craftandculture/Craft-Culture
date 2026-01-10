'use client';

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
  poInfo: {
    fontSize: 9,
    color: '#737373',
    marginBottom: 3,
    lineHeight: 1.3,
  },
  poInfoValue: {
    color: '#0a0a0a',
    fontWeight: 'bold',
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
  partnerBox: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 4,
    borderLeft: '3px solid #6BBFBF',
  },
  partnerText: {
    fontSize: 9,
    marginBottom: 5,
    color: '#525252',
    lineHeight: 1.5,
  },
  partnerName: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#0a0a0a',
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#525252',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottom: '1px solid #e5e5e5',
  },
  tableRowAlt: {
    backgroundColor: '#fafafa',
  },
  tableCell: {
    fontSize: 9,
    color: '#0a0a0a',
  },
  tableCellMuted: {
    fontSize: 8,
    color: '#737373',
    marginTop: 2,
  },
  productCol: {
    flex: 3,
    paddingRight: 8,
  },
  qtyCol: {
    width: 60,
    textAlign: 'right',
  },
  priceCol: {
    width: 80,
    textAlign: 'right',
  },
  totalCol: {
    width: 80,
    textAlign: 'right',
  },
  summaryBox: {
    marginTop: 20,
    paddingTop: 16,
    borderTop: '2px solid #e5e5e5',
    alignItems: 'flex-end',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 10,
    color: '#737373',
    width: 100,
    textAlign: 'right',
    marginRight: 16,
  },
  summaryValue: {
    fontSize: 10,
    color: '#0a0a0a',
    width: 100,
    textAlign: 'right',
  },
  summaryTotal: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    paddingTop: 8,
    borderTop: '1px solid #e5e5e5',
  },
  summaryTotalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0a0a0a',
    width: 100,
    textAlign: 'right',
    marginRight: 16,
  },
  summaryTotalValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6BBFBF',
    width: 100,
    textAlign: 'right',
  },
  termsSection: {
    marginTop: 30,
    paddingTop: 20,
    borderTop: '1px solid #e5e5e5',
  },
  termsTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#0a0a0a',
  },
  termsText: {
    fontSize: 8,
    color: '#737373',
    lineHeight: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTop: '1px solid #e5e5e5',
  },
  footerText: {
    fontSize: 8,
    color: '#a3a3a3',
  },
});

interface PurchaseOrderItem {
  id: string;
  productName: string;
  producer: string | null;
  vintage: string | null;
  lwin: string | null;
  quantity: number;
  unitType: string;
  caseConfig: number | null;
  unitPriceUsd: number;
  lineTotalUsd: number;
}

interface PurchaseOrderPDFTemplateProps {
  poNumber: string;
  partnerName: string;
  partnerAddress?: string;
  createdAt: Date;
  deliveryAddress?: string;
  deliveryInstructions?: string;
  paymentTerms?: string;
  notes?: string;
  items: PurchaseOrderItem[];
  totalAmountUsd: number;
}

const formatPrice = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDate = (date: Date) => {
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * PDF template for Purchase Orders
 */
const PurchaseOrderPDFTemplate = ({
  poNumber,
  partnerName,
  partnerAddress,
  createdAt,
  deliveryAddress,
  deliveryInstructions,
  paymentTerms,
  notes,
  items,
  totalAmountUsd,
}: PurchaseOrderPDFTemplateProps) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.companyName}>CRAFT & CULTURE</Text>
            <Text style={styles.title}>PURCHASE ORDER</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.poInfo}>
              PO Number: <Text style={styles.poInfoValue}>{poNumber}</Text>
            </Text>
            <Text style={styles.poInfo}>
              Date: <Text style={styles.poInfoValue}>{formatDate(createdAt)}</Text>
            </Text>
          </View>
        </View>

        {/* Partner Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Supplier</Text>
          <View style={styles.partnerBox}>
            <Text style={styles.partnerName}>{partnerName}</Text>
            {partnerAddress && <Text style={styles.partnerText}>{partnerAddress}</Text>}
          </View>
        </View>

        {/* Delivery Details */}
        {(deliveryAddress || deliveryInstructions) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery</Text>
            <View style={styles.partnerBox}>
              {deliveryAddress && (
                <Text style={styles.partnerText}>
                  <Text style={{ fontWeight: 'bold' }}>Address: </Text>
                  {deliveryAddress}
                </Text>
              )}
              {deliveryInstructions && (
                <Text style={styles.partnerText}>
                  <Text style={{ fontWeight: 'bold' }}>Instructions: </Text>
                  {deliveryInstructions}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Line Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <View style={styles.productCol}>
                <Text style={styles.tableHeaderCell}>Product</Text>
              </View>
              <View style={styles.qtyCol}>
                <Text style={styles.tableHeaderCell}>Qty</Text>
              </View>
              <View style={styles.priceCol}>
                <Text style={styles.tableHeaderCell}>Unit Price</Text>
              </View>
              <View style={styles.totalCol}>
                <Text style={styles.tableHeaderCell}>Total</Text>
              </View>
            </View>

            {/* Table Rows */}
            {items.map((item, index) => (
              <View
                key={item.id}
                style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <View style={styles.productCol}>
                  <Text style={styles.tableCell}>{item.productName}</Text>
                  {(item.producer || item.vintage) && (
                    <Text style={styles.tableCellMuted}>
                      {[item.producer, item.vintage].filter(Boolean).join(' · ')}
                    </Text>
                  )}
                  {item.lwin && <Text style={styles.tableCellMuted}>LWIN: {item.lwin}</Text>}
                </View>
                <View style={styles.qtyCol}>
                  <Text style={styles.tableCell}>
                    {item.quantity} {item.unitType}
                    {item.quantity !== 1 ? 's' : ''}
                  </Text>
                  {item.caseConfig && (
                    <Text style={styles.tableCellMuted}>{item.caseConfig}×750ml</Text>
                  )}
                </View>
                <View style={styles.priceCol}>
                  <Text style={styles.tableCell}>{formatPrice(item.unitPriceUsd)}</Text>
                </View>
                <View style={styles.totalCol}>
                  <Text style={styles.tableCell}>{formatPrice(item.lineTotalUsd)}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Summary */}
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Items:</Text>
              <Text style={styles.summaryValue}>{items.length}</Text>
            </View>
            <View style={styles.summaryTotal}>
              <Text style={styles.summaryTotalLabel}>Total:</Text>
              <Text style={styles.summaryTotalValue}>{formatPrice(totalAmountUsd)}</Text>
            </View>
          </View>
        </View>

        {/* Terms & Notes */}
        {(paymentTerms || notes) && (
          <View style={styles.termsSection}>
            {paymentTerms && (
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.termsTitle}>Payment Terms</Text>
                <Text style={styles.termsText}>{paymentTerms}</Text>
              </View>
            )}
            {notes && (
              <View>
                <Text style={styles.termsTitle}>Notes</Text>
                <Text style={styles.termsText}>{notes}</Text>
              </View>
            )}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Craft & Culture Trading LLC</Text>
          <Text style={styles.footerText}>www.craftculture.co</Text>
        </View>
      </Page>
    </Document>
  );
};

export default PurchaseOrderPDFTemplate;
