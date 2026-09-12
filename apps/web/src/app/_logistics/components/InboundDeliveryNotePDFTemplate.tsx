import { Document, Font, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

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

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingHorizontal: 36,
    paddingBottom: 80,
    fontFamily: 'Roboto',
    fontSize: 9,
    color: TEXT_PRIMARY,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingBottom: 14,
    borderBottom: `2px solid ${BRAND_TEAL}`,
  },
  logo: { width: 160, height: 42 },
  brandTagline: { fontSize: 7, color: TEXT_MUTED, marginTop: 4 },
  headerRight: { alignItems: 'flex-end' },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    letterSpacing: 1,
  },
  docInfo: { fontSize: 8, color: TEXT_MUTED, marginBottom: 2, lineHeight: 1.4 },
  partiesRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  partyBox: {
    flex: 1,
    backgroundColor: BRAND_TEAL_LIGHT,
    borderRadius: 4,
    padding: 10,
  },
  partyLabel: {
    fontSize: 7,
    color: TEXT_MUTED,
    letterSpacing: 1,
    marginBottom: 4,
  },
  partyName: { fontSize: 10, fontWeight: 'bold', marginBottom: 2 },
  partyLine: { fontSize: 8, color: TEXT_MUTED, lineHeight: 1.4 },
  statement: {
    borderLeft: `3px solid ${BRAND_TEAL}`,
    paddingLeft: 10,
    paddingVertical: 6,
    marginBottom: 16,
  },
  statementText: { fontSize: 9, lineHeight: 1.5 },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  summaryCell: {
    flex: 1,
    border: `1px solid ${BORDER_LIGHT}`,
    borderRadius: 4,
    padding: 8,
  },
  summaryLabel: { fontSize: 7, color: TEXT_MUTED, letterSpacing: 0.8, marginBottom: 3 },
  summaryValue: { fontSize: 13, fontWeight: 'bold' },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 6,
    paddingBottom: 4,
    borderBottom: `1px solid ${BORDER_LIGHT}`,
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: BRAND_TEAL_LIGHT,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  th: { fontSize: 7, fontWeight: 'bold', color: TEXT_MUTED, letterSpacing: 0.5 },
  tr: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottom: `1px solid ${BORDER_LIGHT}`,
  },
  td: { fontSize: 8 },
  colProduct: { flex: 4 },
  colCode: { flex: 2 },
  colPack: { flex: 1.4, textAlign: 'center' },
  colCases: { flex: 1, textAlign: 'right' },
  colBottles: { flex: 1.2, textAlign: 'right' },
  totalRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderTop: `2px solid ${BRAND_TEAL}`,
  },
  totalLabel: { flex: 7.4, fontSize: 9, fontWeight: 'bold' },
  totalCases: { flex: 1, fontSize: 9, fontWeight: 'bold', textAlign: 'right' },
  totalBottles: { flex: 1.2, fontSize: 9, fontWeight: 'bold', textAlign: 'right' },
  notesBox: {
    marginTop: 14,
    border: `1px solid ${BORDER_LIGHT}`,
    borderRadius: 4,
    padding: 8,
  },
  signRow: { flexDirection: 'row', gap: 24, marginTop: 22 },
  signCell: { flex: 1 },
  signLine: { borderBottom: `1px solid ${TEXT_MUTED}`, height: 28 },
  signImage: { height: 26, marginBottom: 2, objectFit: 'contain' },
  signName: { fontSize: 9, fontWeight: 'bold' },
  signLabel: { fontSize: 7, color: TEXT_MUTED, marginTop: 4 },
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 36,
    right: 36,
    paddingTop: 8,
    borderTop: `1px solid ${BORDER_LIGHT}`,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: { fontSize: 7, color: TEXT_MUTED },
});

export interface InboundDeliveryNotePDFTemplateProps {
  deliveryNote: { deliveryNoteNumber: string; generatedAt: Date };
  shipment: {
    shipmentNumber: string;
    supplierName: string | null;
    originCountry?: string | null;
    originAddress?: string | null;
    warehouseName?: string | null;
    reference?: string | null;
    awbOrContainer?: string | null;
    palletCount?: number | null;
    arrivedAt?: Date | null;
    notes?: string | null;
  };
  /** Drawn at hand-over on the warehouse tablet. Absent leaves a blank rule to sign by hand. */
  signature?: {
    dataUrl: string;
    signedBy: string;
    signedAt: Date;
  } | null;
  items: Array<{
    productName: string;
    producer?: string | null;
    vintage?: number | null;
    lwin?: string | null;
    cases: number;
    bottlesPerCase?: number | null;
    totalBottles?: number | null;
  }>;
}

/**
 * Delivery note for an INBOUND shipment — confirmation to the supplier that
 * their consignment reached our warehouse.
 *
 * The outbound note under _wms serves the opposite leg (goods leaving for a
 * distributor) and carries order/customer structure this one has no use for,
 * which is why this is a sibling rather than a shared template.
 */
const InboundDeliveryNotePDFTemplate = ({
  deliveryNote,
  shipment,
  signature,
  items,
}: InboundDeliveryNotePDFTemplateProps) => {
  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const bottlesOf = (i: InboundDeliveryNotePDFTemplateProps['items'][number]) =>
    i.totalBottles ?? i.cases * (i.bottlesPerCase ?? 12);

  const totalCases = items.reduce((s, i) => s + i.cases, 0);
  const totalBottles = items.reduce((s, i) => s + bottlesOf(i), 0);
  const arrival = shipment.arrivedAt ?? deliveryNote.generatedAt;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image */}
            <Image style={styles.logo} src="https://wine.craftculture.xyz/images/cc-logo-cropped.png" />
            <Text style={styles.brandTagline}>Craft &amp; Culture FZE &middot; UAE</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.title}>DELIVERY NOTE</Text>
            <Text style={styles.docInfo}>{deliveryNote.deliveryNoteNumber}</Text>
            <Text style={styles.docInfo}>Issued {formatDate(deliveryNote.generatedAt)}</Text>
            <Text style={styles.docInfo}>Shipment {shipment.shipmentNumber}</Text>
          </View>
        </View>

        <View style={styles.partiesRow}>
          <View style={styles.partyBox}>
            <Text style={styles.partyLabel}>CONSIGNED BY</Text>
            <Text style={styles.partyName}>{shipment.supplierName ?? 'Supplier'}</Text>
            {shipment.originAddress ? (
              <Text style={styles.partyLine}>{shipment.originAddress}</Text>
            ) : null}
            {shipment.originCountry ? (
              <Text style={styles.partyLine}>{shipment.originCountry}</Text>
            ) : null}
          </View>
          <View style={styles.partyBox}>
            <Text style={styles.partyLabel}>RECEIVED AT</Text>
            <Text style={styles.partyName}>
              {shipment.warehouseName ?? 'Craft & Culture Warehouse'}
            </Text>
            <Text style={styles.partyLine}>United Arab Emirates</Text>
            <Text style={styles.partyLine}>Arrived {formatDate(arrival)}</Text>
          </View>
        </View>

        <View style={styles.statement}>
          <Text style={styles.statementText}>
            This note confirms that the consignment described below was delivered to and received
            at our warehouse in the condition and quantities recorded, subject to the discrepancies
            noted.
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>PRODUCTS</Text>
            <Text style={styles.summaryValue}>{items.length}</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>CASES</Text>
            <Text style={styles.summaryValue}>{totalCases}</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>BOTTLES</Text>
            <Text style={styles.summaryValue}>{totalBottles}</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>PALLETS</Text>
            <Text style={styles.summaryValue}>{shipment.palletCount ?? '—'}</Text>
          </View>
        </View>

        {shipment.awbOrContainer || shipment.reference ? (
          <Text style={[styles.docInfo, { marginBottom: 12 }]}>
            {shipment.awbOrContainer ? `AWB / Container: ${shipment.awbOrContainer}` : ''}
            {shipment.awbOrContainer && shipment.reference ? '   ·   ' : ''}
            {shipment.reference ? `Supplier reference: ${shipment.reference}` : ''}
          </Text>
        ) : null}

        <Text style={styles.sectionTitle}>Goods received</Text>
        <View style={styles.tableHead}>
          <Text style={[styles.th, styles.colProduct]}>PRODUCT</Text>
          <Text style={[styles.th, styles.colCode]}>LWIN</Text>
          <Text style={[styles.th, styles.colPack]}>PACK</Text>
          <Text style={[styles.th, styles.colCases]}>CASES</Text>
          <Text style={[styles.th, styles.colBottles]}>BOTTLES</Text>
        </View>
        {items.map((i, idx) => (
          <View key={`${i.lwin ?? i.productName}-${idx}`} style={styles.tr} wrap={false}>
            <Text style={[styles.td, styles.colProduct]}>
              {[i.producer, i.productName, i.vintage ? String(i.vintage) : null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            <Text style={[styles.td, styles.colCode]}>{i.lwin ?? '—'}</Text>
            <Text style={[styles.td, styles.colPack]}>{i.bottlesPerCase ?? 12}</Text>
            <Text style={[styles.td, styles.colCases]}>{i.cases}</Text>
            <Text style={[styles.td, styles.colBottles]}>{bottlesOf(i)}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalCases}>{totalCases}</Text>
          <Text style={styles.totalBottles}>{totalBottles}</Text>
        </View>

        {shipment.notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.partyLabel}>NOTES / DISCREPANCIES</Text>
            <Text style={styles.td}>{shipment.notes}</Text>
          </View>
        ) : null}

        <View style={styles.signRow}>
          <View style={styles.signCell}>
            {signature ? (
              <>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image */}
                <Image style={styles.signImage} src={signature.dataUrl} />
                <View style={styles.signLine} />
                <Text style={styles.signName}>{signature.signedBy}</Text>
              </>
            ) : (
              <View style={styles.signLine} />
            )}
            <Text style={styles.signLabel}>RECEIVED BY (CRAFT &amp; CULTURE)</Text>
          </View>
          <View style={styles.signCell}>
            {signature ? (
              <>
                <View style={{ height: 26 }} />
                <View style={styles.signLine} />
                <Text style={styles.signName}>{formatDate(signature.signedAt)}</Text>
              </>
            ) : (
              <View style={styles.signLine} />
            )}
            <Text style={styles.signLabel}>DATE</Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {deliveryNote.deliveryNoteNumber} &middot; {shipment.shipmentNumber}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
};

export default InboundDeliveryNotePDFTemplate;
