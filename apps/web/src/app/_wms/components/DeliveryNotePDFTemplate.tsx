import { Document, Font, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

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

const BRAND_TEAL = '#6BBFBF';
const BRAND_TEAL_LIGHT = '#f0fafa';
const TEXT_PRIMARY = '#0a0a0a';
const TEXT_MUTED = '#737373';
const BORDER_LIGHT = '#e5e5e5';

// PDF Styles
const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingHorizontal: 36,
    paddingBottom: 90,
    fontFamily: 'Roboto',
    fontSize: 9,
    color: TEXT_PRIMARY,
    backgroundColor: '#ffffff',
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: `2px solid ${BRAND_TEAL}`,
  },
  headerLeft: {
    maxWidth: '50%',
  },
  logo: {
    width: 160,
    height: 42,
  },
  brandTagline: {
    fontSize: 7,
    color: TEXT_MUTED,
    marginTop: 4,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
    marginBottom: 10,
    letterSpacing: 1,
  },
  docInfo: {
    fontSize: 8,
    color: TEXT_MUTED,
    marginBottom: 2,
    lineHeight: 1.4,
  },
  // Summary
  summaryBox: {
    flexDirection: 'row',
    backgroundColor: BRAND_TEAL_LIGHT,
    padding: 10,
    borderRadius: 4,
    marginBottom: 20,
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: BRAND_TEAL,
  },
  summaryLabel: {
    fontSize: 7,
    color: TEXT_MUTED,
    marginTop: 2,
  },
  // Address columns
  addressRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  addressCol: {
    flex: 1,
  },
  addressBox: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 4,
    borderLeft: `3px solid ${BRAND_TEAL}`,
    minHeight: 60,
  },
  addressLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: TEXT_MUTED,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addressText: {
    fontSize: 9,
    lineHeight: 1.5,
    color: TEXT_PRIMARY,
  },
  addressBold: {
    fontWeight: 'bold',
  },
  // Section
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingBottom: 4,
    borderBottom: `1px solid ${BORDER_LIGHT}`,
    marginBottom: 8,
  },
  // Items table
  table: {
    width: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: BRAND_TEAL,
    color: '#ffffff',
    paddingVertical: 7,
    paddingHorizontal: 10,
    fontWeight: 'bold',
    fontSize: 7.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: `1px solid ${BORDER_LIGHT}`,
    paddingVertical: 6,
    paddingHorizontal: 10,
    fontSize: 8,
  },
  tableRowAlt: {
    backgroundColor: '#fafafa',
  },
  // Order group header
  orderGroupHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottom: `1px solid ${BORDER_LIGHT}`,
  },
  orderGroupText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
  },
  orderGroupMeta: {
    fontSize: 8,
    color: TEXT_MUTED,
    marginLeft: 'auto',
  },
  // Column widths
  colNo: {
    width: 24,
    textAlign: 'center',
  },
  colProduct: {
    flex: 3,
  },
  colSku: {
    flex: 1.5,
  },
  colQty: {
    width: 50,
    textAlign: 'center',
  },
  colUnit: {
    width: 50,
    textAlign: 'center',
  },
  productName: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
  },
  productMeta: {
    fontSize: 7,
    color: TEXT_MUTED,
    marginTop: 1,
  },
  // Totals row
  totalsRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTop: `2px solid ${BRAND_TEAL}`,
    backgroundColor: BRAND_TEAL_LIGHT,
  },
  totalsLabel: {
    flex: 1,
    fontSize: 9,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
  },
  totalsValue: {
    width: 50,
    textAlign: 'center',
    fontSize: 9,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
  },
  // Notes
  notesSection: {
    marginTop: 16,
    padding: 10,
    backgroundColor: '#fef3c7',
    borderRadius: 4,
    borderLeft: '3px solid #f59e0b',
  },
  notesHeader: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#92400e',
    marginBottom: 3,
  },
  notesText: {
    fontSize: 8,
    color: '#78350f',
    lineHeight: 1.4,
  },
  // Signature
  signatureSection: {
    marginTop: 24,
    paddingTop: 16,
    borderTop: `1px solid ${BORDER_LIGHT}`,
  },
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  signatureBox: {
    width: '45%',
  },
  signatureLine: {
    borderBottom: `1px solid ${TEXT_PRIMARY}`,
    marginTop: 36,
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: 7,
    color: TEXT_MUTED,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    borderTop: `1px solid ${BORDER_LIGHT}`,
    paddingTop: 8,
    backgroundColor: '#ffffff',
  },
  footerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  footerText: {
    fontSize: 6.5,
    color: '#a3a3a3',
  },
  footerBrand: {
    fontSize: 6.5,
    fontWeight: 'bold',
    color: BRAND_TEAL,
  },
  footerDisclaimer: {
    fontSize: 6,
    color: '#a3a3a3',
    marginTop: 4,
    textAlign: 'center',
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
      unit?: string | null;
      lwin18?: string | null;
    }>;
  }>;
}

/**
 * PDF template for WMS delivery notes
 *
 * Generated when dispatching goods to a distributor.
 * Contains batch details, full item manifest, and signature areas
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

  // Flatten all items for the manifest with a running line number
  let lineNumber = 0;
  const totalItems = orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image */}
            <Image
              style={styles.logo}
              src="https://wine.craftculture.xyz/images/cc-logo-cropped.png"
            />
            <Text style={styles.brandTagline}>
              The bridge to the Middle East wine & spirits market
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.title}>DELIVERY NOTE</Text>
            <Text style={styles.docInfo}>DN #: {deliveryNote.deliveryNoteNumber}</Text>
            <Text style={styles.docInfo}>Batch #: {batch.batchNumber}</Text>
            <Text style={styles.docInfo}>Date: {formatDate(deliveryNote.generatedAt)}</Text>
            <Text style={styles.docInfo}>Time: {formatTime(deliveryNote.generatedAt)}</Text>
          </View>
        </View>

        {/* Summary Counts */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{batch.orderCount}</Text>
            <Text style={styles.summaryLabel}>ORDERS</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{totalItems}</Text>
            <Text style={styles.summaryLabel}>CASES</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{orders.reduce((s, o) => s + o.items.length, 0)}</Text>
            <Text style={styles.summaryLabel}>LINE ITEMS</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{batch.palletCount}</Text>
            <Text style={styles.summaryLabel}>PALLETS</Text>
          </View>
        </View>

        {/* Ship From / Deliver To */}
        <View style={styles.addressRow}>
          <View style={styles.addressCol}>
            <Text style={styles.addressLabel}>Ship From</Text>
            <View style={styles.addressBox}>
              <Text style={[styles.addressText, styles.addressBold]}>Craft & Culture FZE</Text>
              <Text style={styles.addressText}>JAFZA Warehouse</Text>
              <Text style={styles.addressText}>Jebel Ali Free Zone</Text>
              <Text style={styles.addressText}>Dubai, UAE</Text>
            </View>
          </View>
          <View style={styles.addressCol}>
            <Text style={styles.addressLabel}>Deliver To</Text>
            <View style={styles.addressBox}>
              <Text style={[styles.addressText, styles.addressBold]}>{batch.distributorName}</Text>
            </View>
          </View>
        </View>

        {/* Item Manifest */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Item Manifest</Text>
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={styles.colNo}>#</Text>
              <Text style={styles.colProduct}>Product</Text>
              <Text style={styles.colSku}>SKU / LWIN</Text>
              <Text style={styles.colQty}>Qty</Text>
              <Text style={styles.colUnit}>Unit</Text>
            </View>

            {/* Orders grouped with items */}
            {orders.map((order) => (
              <View key={order.orderNumber} wrap={false}>
                {/* Order group header */}
                <View style={styles.orderGroupHeader}>
                  <Text style={styles.orderGroupText}>
                    {order.orderNumber} — {order.customerName}
                  </Text>
                  <Text style={styles.orderGroupMeta}>
                    {order.items.length} item{order.items.length !== 1 ? 's' : ''} • {order.totalCases} cases
                  </Text>
                </View>

                {/* Item rows */}
                {order.items.map((item, idx) => {
                  lineNumber++;
                  return (
                    <View
                      key={`${order.orderNumber}-${idx}`}
                      style={lineNumber % 2 === 0 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
                    >
                      <Text style={styles.colNo}>{lineNumber}</Text>
                      <View style={styles.colProduct}>
                        <Text style={styles.productName}>{item.name}</Text>
                      </View>
                      <Text style={styles.colSku}>{item.lwin18 || item.sku || '—'}</Text>
                      <Text style={styles.colQty}>{item.quantity}</Text>
                      <Text style={styles.colUnit}>{item.unit || 'Cases'}</Text>
                    </View>
                  );
                })}
              </View>
            ))}

            {/* Totals Row */}
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Total</Text>
              <Text style={styles.totalsValue}>{totalItems}</Text>
              <Text style={{ width: 50 }} />
            </View>
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
            <View>
              <Text style={styles.footerText}>
                {deliveryNote.deliveryNoteNumber} • {batch.batchNumber}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.footerText}>
                Generated by <Text style={styles.footerBrand}>C&C Index</Text>
              </Text>
              <Text style={styles.footerText}>craftculture.xyz</Text>
            </View>
          </View>
          <Text style={styles.footerDisclaimer}>
            This document confirms the dispatch of goods listed above. Please verify all items upon receipt.
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default DeliveryNotePDFTemplate;
