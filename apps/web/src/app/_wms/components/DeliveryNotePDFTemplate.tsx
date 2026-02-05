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
    marginBottom: 30,
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
  section: {
    marginBottom: 20,
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
  summaryBox: {
    flexDirection: 'row',
    backgroundColor: '#f0fafa',
    padding: 12,
    borderRadius: 4,
    marginBottom: 20,
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6BBFBF',
  },
  summaryLabel: {
    fontSize: 8,
    color: '#737373',
    marginTop: 2,
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
  colOrder: {
    flex: 1.5,
  },
  colCustomer: {
    flex: 2,
  },
  colItems: {
    flex: 1,
    textAlign: 'center',
  },
  colCases: {
    flex: 1,
    textAlign: 'center',
  },
  productName: {
    fontWeight: 'bold',
    marginBottom: 2,
    color: '#0a0a0a',
  },
  productMeta: {
    fontSize: 8,
    color: '#737373',
    lineHeight: 1.3,
  },
  signatureSection: {
    marginTop: 30,
    paddingTop: 20,
    borderTop: '1px solid #e5e5e5',
  },
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  signatureBox: {
    width: '45%',
  },
  signatureLine: {
    borderBottom: '1px solid #0a0a0a',
    marginTop: 40,
    marginBottom: 5,
  },
  signatureLabel: {
    fontSize: 8,
    color: '#737373',
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
  notesSection: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 4,
    borderLeft: '3px solid #f59e0b',
  },
  notesHeader: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#92400e',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 9,
    color: '#78350f',
    lineHeight: 1.4,
  },
});

export interface DeliveryNotePDFTemplateProps {
  deliveryNote: {
    deliveryNoteNumber: string;
    generatedAt: Date;
  };
  batch: {
    batchNumber: string;
    distributorName: string;
    orderCount: number;
    totalCases: number;
    palletCount: number;
    notes?: string | null;
  };
  orders: Array<{
    orderNumber: string;
    customerName: string;
    itemCount: number;
    totalCases: number;
    items: Array<{
      name: string;
      sku?: string | null;
      quantity: number;
    }>;
  }>;
}

/**
 * PDF template for WMS delivery notes
 *
 * Generated when dispatching goods to a distributor.
 * Contains batch details, order list, and signature areas
 * for proof of delivery.
 */
const DeliveryNotePDFTemplate = ({
  deliveryNote,
  batch,
  orders,
}: DeliveryNotePDFTemplateProps) => {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
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
            <Text style={styles.title}>DELIVERY NOTE</Text>
            <Text style={styles.docInfo}>DN #: {deliveryNote.deliveryNoteNumber}</Text>
            <Text style={styles.docInfo}>Batch #: {batch.batchNumber}</Text>
            <Text style={styles.docInfo}>Date: {formatDate(deliveryNote.generatedAt)}</Text>
            <Text style={styles.docInfo}>Time: {formatTime(deliveryNote.generatedAt)}</Text>
          </View>
        </View>

        {/* Summary Box */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{batch.orderCount}</Text>
            <Text style={styles.summaryLabel}>ORDERS</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{batch.totalCases}</Text>
            <Text style={styles.summaryLabel}>CASES</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{batch.palletCount}</Text>
            <Text style={styles.summaryLabel}>PALLETS</Text>
          </View>
        </View>

        {/* Recipient Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery To</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              <Text style={styles.infoLabel}>Distributor: </Text>
              {batch.distributorName}
            </Text>
          </View>
        </View>

        {/* Orders List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Orders Included</Text>
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={styles.colOrder}>Order #</Text>
              <Text style={styles.colCustomer}>Customer</Text>
              <Text style={styles.colItems}>Items</Text>
              <Text style={styles.colCases}>Cases</Text>
            </View>

            {/* Table Rows */}
            {orders.map((order, index) => (
              <View
                key={order.orderNumber}
                style={index % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
                wrap={false}
              >
                <View style={styles.colOrder}>
                  <Text style={styles.productName}>{order.orderNumber}</Text>
                </View>
                <Text style={styles.colCustomer}>{order.customerName}</Text>
                <Text style={styles.colItems}>{order.itemCount}</Text>
                <Text style={styles.colCases}>{order.totalCases}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Notes */}
        {batch.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesHeader}>Notes</Text>
            <Text style={styles.notesText}>{batch.notes}</Text>
          </View>
        )}

        {/* Signature Section */}
        <View style={styles.signatureSection} wrap={false}>
          <Text style={styles.sectionTitle}>Proof of Delivery</Text>
          <View style={styles.signatureRow}>
            <View style={styles.signatureBox}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>Warehouse Representative</Text>
            </View>
            <View style={styles.signatureBox}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>Received By (Name & Signature)</Text>
            </View>
          </View>
          <View style={styles.signatureRow}>
            <View style={styles.signatureBox}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>Date & Time</Text>
            </View>
            <View style={styles.signatureBox}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>Date & Time</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <View style={styles.footerContent}>
            <View style={styles.footerLeft}>
              <Text style={styles.footerText}>
                Delivery Note {deliveryNote.deliveryNoteNumber} • {batch.batchNumber}
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
            © Craft & Culture FZE - Warehouse Management System
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default DeliveryNotePDFTemplate;
