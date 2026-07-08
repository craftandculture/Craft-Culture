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
const REPACK_BG = '#fef3c7';
const REPACK_BORDER = '#f59e0b';
const REPACK_TEXT = '#92400e';

// PDF Styles
const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingHorizontal: 36,
    paddingBottom: 70,
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
    marginBottom: 20,
    paddingBottom: 16,
    borderBottom: `2px solid ${BRAND_TEAL}`,
  },
  headerLeft: {
    maxWidth: '55%',
  },
  logo: {
    width: 160,
    height: 42,
  },
  brandName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
    letterSpacing: 1,
    marginTop: 6,
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
    marginBottom: 8,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 8,
    color: TEXT_MUTED,
    marginBottom: 2,
    lineHeight: 1.4,
    textAlign: 'right',
  },
  docInfo: {
    fontSize: 8,
    color: TEXT_MUTED,
    marginBottom: 2,
    lineHeight: 1.4,
  },
  // Summary strip
  summaryBox: {
    flexDirection: 'row',
    backgroundColor: BRAND_TEAL_LIGHT,
    padding: 10,
    borderRadius: 4,
    marginBottom: 18,
    justifyContent: 'space-between',
  },
  summaryItem: {
    flex: 1,
    paddingHorizontal: 4,
  },
  summaryValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
  },
  summaryValueTeal: {
    fontSize: 10,
    fontWeight: 'bold',
    color: BRAND_TEAL,
  },
  summaryLabel: {
    fontSize: 6.5,
    color: TEXT_MUTED,
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Aisle group header
  aisleHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottom: `1px solid ${BORDER_LIGHT}`,
    marginTop: 10,
  },
  aisleText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
    letterSpacing: 0.5,
  },
  aisleMeta: {
    fontSize: 8,
    color: TEXT_MUTED,
    marginLeft: 'auto',
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
    paddingHorizontal: 8,
    fontWeight: 'bold',
    fontSize: 7,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: `1px solid ${BORDER_LIGHT}`,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 8,
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: '#fafafa',
  },
  // Column widths
  colCheck: {
    width: 20,
    textAlign: 'center',
  },
  checkBox: {
    width: 11,
    height: 11,
    border: `1px solid ${TEXT_MUTED}`,
    borderRadius: 2,
    marginHorizontal: 'auto',
  },
  colNo: {
    width: 20,
    textAlign: 'center',
  },
  colBin: {
    width: 58,
    fontWeight: 'bold',
  },
  colStorage: {
    width: 78,
  },
  colProduct: {
    flex: 3,
    paddingRight: 4,
  },
  colVintage: {
    width: 40,
    textAlign: 'center',
  },
  colPack: {
    width: 46,
    textAlign: 'center',
  },
  colQty: {
    width: 58,
    textAlign: 'right',
  },
  colInvLn: {
    width: 34,
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
  qtyNumber: {
    fontSize: 10,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
  },
  qtyUnit: {
    fontSize: 6.5,
    color: TEXT_MUTED,
    textTransform: 'uppercase',
  },
  binText: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
  },
  // Badges
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  badge: {
    fontSize: 6.5,
    fontWeight: 'bold',
    color: '#ffffff',
    backgroundColor: TEXT_MUTED,
    paddingVertical: 1.5,
    paddingHorizontal: 4,
    borderRadius: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  badgePallet: {
    backgroundColor: '#7c6f5b',
  },
  badgeShelf: {
    backgroundColor: BRAND_TEAL,
  },
  badgeRepack: {
    backgroundColor: REPACK_BORDER,
  },
  // Repack sub-row
  repackRow: {
    flexDirection: 'row',
    backgroundColor: REPACK_BG,
    borderLeft: `3px solid ${REPACK_BORDER}`,
    borderBottom: `1px solid ${BORDER_LIGHT}`,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  repackText: {
    fontSize: 7.5,
    color: REPACK_TEXT,
    lineHeight: 1.4,
  },
  repackBold: {
    fontWeight: 'bold',
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
});

export interface PickingListLineItem {
  bin: string;
  storageMethod: 'pallet' | 'shelf';
  productName: string;
  producer?: string | null;
  vintage?: string | null;
  pack: string;
  qtyToPick: number;
  qtyUnit: 'cases' | 'bottles';
  invLineNumber: number;
  isRepack: boolean;
  repackInstruction?: string | null;
}

export interface PickingListPDFTemplateProps {
  pickListNumber: string;
  orderRef: string;
  consignee: string;
  dispatchTo: string;
  date: Date;
  items: PickingListLineItem[];
}

/**
 * Derive the aisle segment from a bin/location code
 *
 * @example
 *   getAisle('A-04-01'); // returns 'A'
 *
 * @param bin - The location code
 * @returns The leading aisle segment
 */
const getAisle = (bin: string) => {
  const trimmed = (bin || '').trim();
  if (!trimmed) return '—';
  const segment = trimmed.split(/[-_/\s]/)[0];
  return (segment || trimmed).toUpperCase();
};

/**
 * PDF template for WMS picking lists
 *
 * Generated for warehouse operators to pick stock for an order. Lines are
 * grouped by aisle for an efficient walk path, with repack instructions
 * highlighted under any partial-case pick.
 */
const PickingListPDFTemplate = ({
  pickListNumber,
  orderRef,
  consignee,
  dispatchTo,
  date,
  items,
}: PickingListPDFTemplateProps) => {
  const formatDate = (value: Date) => {
    return new Date(value).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Totals for the summary strip
  const repackCount = items.filter((item) => item.isRepack).length;
  const totalCases = items
    .filter((item) => item.qtyUnit === 'cases')
    .reduce((sum, item) => sum + item.qtyToPick, 0);
  const totalBottles = items
    .filter((item) => item.qtyUnit === 'bottles')
    .reduce((sum, item) => sum + item.qtyToPick, 0);

  // Group items by aisle, preserving incoming (sorted) order
  const aisleOrder: string[] = [];
  const aisleGroups = new Map<string, PickingListLineItem[]>();
  for (const item of items) {
    const aisle = getAisle(item.bin);
    if (!aisleGroups.has(aisle)) {
      aisleGroups.set(aisle, []);
      aisleOrder.push(aisle);
    }
    aisleGroups.get(aisle)!.push(item);
  }

  let rowNumber = 0;

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
            <Text style={styles.brandName}>CRAFT &amp; CULTURE</Text>
            <Text style={styles.brandTagline}>
              The bridge to the Middle East wine &amp; spirits market
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.title}>PICKING LIST</Text>
            <Text style={styles.subtitle}>
              For {orderRef} · {consignee} · {formatDate(date)}
            </Text>
            <Text style={styles.docInfo}>Pick List #: {pickListNumber}</Text>
          </View>
        </View>

        {/* Summary strip */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Order Ref</Text>
            <Text style={styles.summaryValue}>{orderRef}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Consignee</Text>
            <Text style={styles.summaryValue}>{consignee}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Pick Lines</Text>
            <Text style={styles.summaryValueTeal}>
              {items.length} lines · {repackCount} repack
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>To Pick</Text>
            <Text style={styles.summaryValueTeal}>
              {totalCases} cases · {totalBottles} bottles
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Dispatch To</Text>
            <Text style={styles.summaryValue}>{dispatchTo}</Text>
          </View>
        </View>

        {/* Table header */}
        <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            <Text style={styles.colCheck}>{'□'}</Text>
            <Text style={styles.colNo}>#</Text>
            <Text style={styles.colBin}>Bin</Text>
            <Text style={styles.colStorage}>Storage</Text>
            <Text style={styles.colProduct}>Product</Text>
            <Text style={styles.colVintage}>Vintage</Text>
            <Text style={styles.colPack}>Pack</Text>
            <Text style={styles.colQty}>Qty to Pick</Text>
            <Text style={styles.colInvLn}>Inv Ln</Text>
          </View>

          {/* Aisle groups */}
          {aisleOrder.map((aisle) => {
            const groupItems = aisleGroups.get(aisle) ?? [];
            return (
              <View key={aisle}>
                <View style={styles.aisleHeader}>
                  <Text style={styles.aisleText}>AISLE {aisle}</Text>
                  <Text style={styles.aisleMeta}>
                    {groupItems.length} line{groupItems.length !== 1 ? 's' : ''}
                  </Text>
                </View>

                {groupItems.map((item, idx) => {
                  rowNumber += 1;
                  const isAlt = rowNumber % 2 === 0;
                  return (
                    <View key={`${aisle}-${idx}`} wrap={false}>
                      <View style={isAlt ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}>
                        <View style={styles.colCheck}>
                          <View style={styles.checkBox} />
                        </View>
                        <Text style={styles.colNo}>{rowNumber}</Text>
                        <View style={styles.colBin}>
                          <Text style={styles.binText}>{item.bin}</Text>
                        </View>
                        <View style={styles.colStorage}>
                          <View style={styles.badgeRow}>
                            <Text
                              style={[
                                styles.badge,
                                item.storageMethod === 'pallet'
                                  ? styles.badgePallet
                                  : styles.badgeShelf,
                              ]}
                            >
                              {item.storageMethod === 'pallet' ? 'Pallet' : 'Shelf'}
                            </Text>
                            {item.isRepack ? (
                              <Text style={[styles.badge, styles.badgeRepack]}>Repack</Text>
                            ) : null}
                          </View>
                        </View>
                        <View style={styles.colProduct}>
                          <Text style={styles.productName}>{item.productName}</Text>
                          {item.producer ? (
                            <Text style={styles.productMeta}>{item.producer}</Text>
                          ) : null}
                        </View>
                        <Text style={styles.colVintage}>{item.vintage || 'NV'}</Text>
                        <Text style={styles.colPack}>{item.pack}</Text>
                        <View style={styles.colQty}>
                          <Text style={styles.qtyNumber}>{item.qtyToPick}</Text>
                          <Text style={styles.qtyUnit}>{item.qtyUnit}</Text>
                        </View>
                        <Text style={styles.colInvLn}>{item.invLineNumber}</Text>
                      </View>

                      {item.isRepack && item.repackInstruction ? (
                        <View style={styles.repackRow}>
                          <Text style={styles.repackText}>
                            <Text style={styles.repackBold}>{'↻'} REPACK — {item.productName}: </Text>
                            {item.repackInstruction}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <View style={styles.footerContent}>
            <View>
              <Text style={styles.footerText}>
                {pickListNumber} · {orderRef}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.footerText}>
                Generated by <Text style={styles.footerBrand}>C&amp;C Index</Text>
              </Text>
              <Text style={styles.footerText}>craftculture.xyz</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default PickingListPDFTemplate;
