import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

import type { ExportDocument } from '../schemas/exportDocumentSchema';
import deriveBoeTable from '../utils/deriveBoeTable';
import deriveDocumentTotals from '../utils/deriveDocumentTotals';
import formatSectionTitle from '../utils/formatSectionTitle';

export interface ExportInvoicePDFTemplateProps {
  document: ExportDocument;
}

const INK = '#1a1a1a';
const MUTED = '#666666';
const RULE = '#dddddd';
const SECTION = '#2a5a4a';

const styles = StyleSheet.create({
  page: { paddingTop: 22, paddingHorizontal: 34, paddingBottom: 34, fontFamily: 'Helvetica', fontSize: 7.5, color: INK },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1.5px solid ${INK}`, paddingBottom: 5, marginBottom: 6 },
  logo: { width: 120, height: 32 },
  tagline: { fontSize: 7, color: MUTED, marginTop: 2 },
  title: { fontSize: 13, fontFamily: 'Helvetica-Bold', textAlign: 'right', letterSpacing: 1 },
  number: { fontSize: 8, color: MUTED, textAlign: 'right', marginTop: 3 },
  draft: { fontSize: 8, color: '#b45309', textAlign: 'right', marginTop: 3, fontFamily: 'Helvetica-Bold' },
  parties: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  party: { flex: 1 },
  partyLabel: { fontSize: 6, color: MUTED, textTransform: 'uppercase', borderBottom: `0.5px solid ${RULE}`, paddingBottom: 1.5, marginBottom: 2 },
  partyName: { fontSize: 8, fontFamily: 'Helvetica-Bold', marginBottom: 1 },
  partyLine: { fontSize: 7, color: '#333333', lineHeight: 1.25 },
  details: { flexDirection: 'row', backgroundColor: '#f5f5f5', borderRadius: 3, paddingVertical: 4, paddingHorizontal: 8, marginBottom: 6 },
  detail: { flex: 1 },
  detailLabel: { fontSize: 6, color: MUTED, textTransform: 'uppercase', marginBottom: 2 },
  detailValue: { fontSize: 8.5, fontFamily: 'Helvetica-Bold' },
  th: { flexDirection: 'row', backgroundColor: INK, color: '#ffffff', fontSize: 6, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', paddingVertical: 3 },
  row: { flexDirection: 'row', borderBottom: `0.5px solid #eeeeee`, paddingVertical: 1.5 },
  sectionRow: { backgroundColor: SECTION, color: '#ffffff', fontSize: 6.5, fontFamily: 'Helvetica-Bold', paddingVertical: 1.5, paddingHorizontal: 5 },
  cell: { paddingHorizontal: 4 },
  right: { textAlign: 'right' },
  center: { textAlign: 'center' },
  bottom: { flexDirection: 'row', gap: 12, marginTop: 6 },
  boeBox: { flex: 1.4, backgroundColor: '#f5f5f5', border: `0.5px solid ${RULE}`, borderRadius: 3, padding: 5 },
  boeTitle: { fontSize: 7, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 3 },
  boeRow: { flexDirection: 'row', borderBottom: `0.5px solid #cccccc` },
  totals: { flex: 1 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottom: `0.5px solid ${RULE}`, paddingVertical: 3, fontSize: 8.5 },
  grandTotal: { flexDirection: 'row', justifyContent: 'space-between', borderTop: `1.5px solid ${INK}`, paddingTop: 4, marginTop: 2, fontSize: 11, fontFamily: 'Helvetica-Bold' },
  small: { fontSize: 6.5, color: '#555555', marginTop: 5, lineHeight: 1.3 },
  footer: { borderTop: `0.5px solid ${RULE}`, marginTop: 6, paddingTop: 4 },
  signRow: { flexDirection: 'row', gap: 14, marginTop: 6 },
  signBox: { flex: 1, border: '1px dashed #c8c8c8', borderRadius: 6, height: 30, justifyContent: 'flex-end', alignItems: 'center', padding: 3 },
  signHint: { fontSize: 7, color: '#bbbbbb', textTransform: 'uppercase' },
  signFields: { width: 180, justifyContent: 'flex-end', gap: 8 },
  signField: { borderBottom: '0.5px solid #999999', paddingBottom: 3, fontSize: 8, color: '#444444' },
  pageNumber: { position: 'absolute', bottom: 14, right: 34, fontSize: 6.5, color: MUTED },
});

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * The combined Commercial Invoice & Packing List, as a PDF
 *
 * A port of the hand-built HTML (EXP-2026-0029 onward): landscape A4, the
 * three party boxes, the details strip, a sectioned table counted in cartons,
 * the BOE table beside the totals, and the signature block. Everything is
 * drawn from the document, so it cannot disagree with the screen.
 */
const ExportInvoicePDFTemplate = ({ document: doc }: ExportInvoicePDFTemplateProps) => {
  const totals = deriveDocumentTotals(doc);
  const boes = deriveBoeTable(doc);
  const cur = doc.header.currency;
  const extra = doc.extraColumns;
  const descWidth = Math.max(20, 34 - extra.length * 5);
  const col = {
    n: '3%', desc: `${descWidth}%`, hs: '8%', origin: '9%', pack: '7%', qty: '5%', btl: '6%', extra: '7%', unit: '10%', amount: '11%',
  };
  const sizes = totals.bottlesBySize.map(([cl, n]) => `${n}×${cl}cl`).join(' + ');
  const invoiceList = doc.sources.map((s) => s.invoiceNumber).join(', ');

  // Lines are stored in print order, so the index is the printed line number
  const lineNumber = new Map(doc.lines.map((l, i) => [l.id, i + 1]));
  const parties: [string, ExportDocument['header']['exporter']][] = [
    ['Exporter / Shipper', doc.header.exporter],
    ['Consignee / Importer', doc.header.consignee],
    ['Collection Address', doc.header.collection],
  ];
  const details: [string, string][] = [
    ['Invoice Date', longDate(doc.header.date)],
    ['Terms of Delivery', doc.header.terms],
    ['Currency', cur],
    ['Total Pallets', doc.header.pallets === null ? 'TBC' : `${doc.header.pallets} Pallet${doc.header.pallets === 1 ? '' : 's'}`],
    ['Total Cases', `${totals.declaredCases} Cases`],
    ['Bottles', `${totals.bottles} btl`],
    ['Gross Weight', doc.header.grossWeightKg === null ? 'TBC' : `${doc.header.grossWeightKg} kg`],
  ];

  return (
    <Document title={doc.header.number ?? 'Draft export invoice'}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <View>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image */}
            <Image style={styles.logo} src="https://wine.craftculture.xyz/images/cc-logo-cropped.png" />
            <Text style={styles.tagline}>Craft and Culture FZE · Fine Wine Import &amp; Distribution</Text>
          </View>
          <View>
            <Text style={styles.title}>COMMERCIAL INVOICE</Text>
            <Text style={styles.title}>&amp; PACKING LIST</Text>
            {doc.header.number ? (
              <Text style={styles.number}>{`${doc.header.number} · Combined · ${invoiceList}`}</Text>
            ) : (
              <Text style={styles.draft}>DRAFT — NOT FOR SUBMISSION</Text>
            )}
          </View>
        </View>

        <View style={styles.parties}>
          {parties.map(([label, p]) => (
            <View key={label} style={styles.party}>
              <Text style={styles.partyLabel}>{label}</Text>
              <Text style={styles.partyName}>{p.name}</Text>
              {p.addressLines.map((l) => (
                <Text key={l} style={styles.partyLine}>{l}</Text>
              ))}
              {p.trn && <Text style={styles.partyLine}>{`TRN: ${p.trn}`}</Text>}
            </View>
          ))}
        </View>

        <View style={styles.details}>
          {details.map(([label, value]) => (
            <View key={label} style={styles.detail}>
              <Text style={styles.detailLabel}>{label}</Text>
              <Text style={styles.detailValue}>{value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.th} fixed>
          <Text style={[styles.cell, { width: col.n }]}>#</Text>
          <Text style={[styles.cell, { width: col.desc }]}>Description of Goods</Text>
          <Text style={[styles.cell, { width: col.hs }]}>HS Code</Text>
          <Text style={[styles.cell, { width: col.origin }]}>Origin</Text>
          <Text style={[styles.cell, { width: col.pack }]}>Pack Size</Text>
          <Text style={[styles.cell, styles.center, { width: col.qty }]}>Qty</Text>
          <Text style={[styles.cell, styles.center, { width: col.btl }]}>Bottles</Text>
          {extra.map((c) => (
            <Text key={c.key} style={[styles.cell, { width: col.extra }]}>{c.label}</Text>
          ))}
          <Text style={[styles.cell, styles.right, { width: col.unit }]}>{`Unit Price ${cur}`}</Text>
          <Text style={[styles.cell, styles.right, { width: col.amount }]}>{`Amount ${cur}`}</Text>
        </View>

        {doc.sections.map((section) => (
          <View key={section.id}>
            <Text style={styles.sectionRow} wrap={false}>{formatSectionTitle(section)}</Text>
            {doc.lines
              .filter((l) => l.sectionId === section.id)
              .map((l) => {
                const lineNo = lineNumber.get(l.id) ?? 0;
                if (l.kind === 'mixedCase') {
                  // Customs want origin and HS per item: a carton row, then each wine
                  return (
                    <View key={l.id} wrap={false}>
                      <View style={[styles.row, { backgroundColor: '#f7f7f7' }]}>
                        <Text style={[styles.cell, { width: col.n }]}>{lineNo}</Text>
                        <Text style={[styles.cell, { width: col.desc, fontFamily: 'Helvetica-Bold' }]}>
                          {`Mixed case of ${l.packBottles} × ${l.bottleSizeCl}cl — contents below`}
                        </Text>
                        <Text style={[styles.cell, { width: col.hs }]} />
                        <Text style={[styles.cell, { width: col.origin }]} />
                        <Text style={[styles.cell, { width: col.pack }]}>{`${l.packBottles}x${l.bottleSizeCl}cl`}</Text>
                        <Text style={[styles.cell, styles.center, { width: col.qty }]}>{l.qty}</Text>
                        <Text style={[styles.cell, styles.center, { width: col.btl }]}>{l.qty * l.packBottles}</Text>
                        {extra.map((c) => (
                          <Text key={c.key} style={[styles.cell, { width: col.extra }]}>{l.extra[c.key] ?? ''}</Text>
                        ))}
                        <Text style={[styles.cell, { width: col.unit }]} />
                        <Text style={[styles.cell, { width: col.amount }]} />
                      </View>
                      {l.components.map((c, i) => (
                        <View key={`${l.id}-${i}`} style={styles.row}>
                          <Text style={[styles.cell, { width: col.n, color: MUTED }]}>{`${lineNo}.${i + 1}`}</Text>
                          <Text style={[styles.cell, { width: col.desc, paddingLeft: 12 }]}>{c.description}</Text>
                          <Text style={[styles.cell, { width: col.hs }]}>{c.hsCode ?? l.hsCode}</Text>
                          <Text style={[styles.cell, { width: col.origin }]}>{c.origin}</Text>
                          <Text style={[styles.cell, { width: col.pack }]}>{`1x${l.bottleSizeCl}cl`}</Text>
                          <Text style={[styles.cell, styles.center, { width: col.qty, color: MUTED }]}>–</Text>
                          <Text style={[styles.cell, styles.center, { width: col.btl }]}>{l.qty}</Text>
                          {extra.map((x) => (
                            <Text key={x.key} style={[styles.cell, { width: col.extra }]} />
                          ))}
                          <Text style={[styles.cell, styles.right, { width: col.unit }]}>{money(c.unitPrice)}</Text>
                          <Text style={[styles.cell, styles.right, { width: col.amount }]}>{money(c.unitPrice * l.qty)}</Text>
                        </View>
                      ))}
                    </View>
                  );
                }
                return (
                  <View key={l.id} style={styles.row} wrap={false}>
                    <Text style={[styles.cell, { width: col.n }]}>{lineNo}</Text>
                    <Text style={[styles.cell, { width: col.desc }]}>{l.description}</Text>
                    <Text style={[styles.cell, { width: col.hs }]}>{l.hsCode}</Text>
                    <Text style={[styles.cell, { width: col.origin }]}>{l.origin}</Text>
                    <Text style={[styles.cell, { width: col.pack }]}>{`${l.packBottles}x${l.bottleSizeCl}cl`}</Text>
                    <Text style={[styles.cell, styles.center, { width: col.qty }]}>{l.qty}</Text>
                    <Text style={[styles.cell, styles.center, { width: col.btl }]}>{l.qty * l.packBottles}</Text>
                    {extra.map((c) => (
                      <Text key={c.key} style={[styles.cell, { width: col.extra }]}>{l.extra[c.key] ?? ''}</Text>
                    ))}
                    <Text style={[styles.cell, styles.right, { width: col.unit }]}>{money(l.unitPrice)}</Text>
                    <Text style={[styles.cell, styles.right, { width: col.amount }]}>{money(l.amount)}</Text>
                  </View>
                );
              })}
          </View>
        ))}

        <View style={styles.bottom} wrap={false}>
          <View style={styles.boeBox}>
            <Text style={styles.boeTitle}>Re-Export Bill of Entry References</Text>
            <View style={[styles.boeRow, { backgroundColor: '#e6e6e6' }]}>
              <Text style={[styles.cell, { width: '30%', fontFamily: 'Helvetica-Bold' }]}>Re-Export BOE Number</Text>
              <Text style={[styles.cell, { width: '40%', fontFamily: 'Helvetica-Bold' }]}>Source Invoice</Text>
              <Text style={[styles.cell, { width: '30%', fontFamily: 'Helvetica-Bold' }]}>Line Items</Text>
            </View>
            {boes.map((b) => (
              <View key={b.boe ?? 'none'} style={styles.boeRow}>
                <Text style={[styles.cell, { width: '30%' }]}>{b.boe ?? 'TBC'}</Text>
                <Text style={[styles.cell, { width: '40%' }]}>{b.invoices.join(', ')}</Text>
                <Text style={[styles.cell, { width: '30%' }]}>{b.lineRanges}</Text>
              </View>
            ))}
          </View>
          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text>Subtotal:</Text>
              <Text>{`${cur} ${money(totals.total)}`}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text>Freight:</Text>
              <Text>Ex Works</Text>
            </View>
            <View style={styles.grandTotal}>
              <Text>TOTAL:</Text>
              <Text>{`${cur} ${money(totals.total)}`}</Text>
            </View>
          </View>
        </View>

        <View wrap={false}>
          <Text style={styles.small}>
            {`Reference Invoices: ${doc.sources
              .map((s) => (s.pcoNumber ? `${s.invoiceNumber} (${s.pcoNumber})` : s.invoiceNumber))
              .join(', ')} · ${totals.declaredCases} cases · ${totals.bottles} bottles (${sizes}).`}
          </Text>
          <Text style={styles.small}>
            {`Qty is the number of cases of the stated Pack Size; Bottles is the resulting bottle count.${
              doc.lines.some((l) => l.kind === 'mixedCase')
                ? ' PCO orders are packed in mixed cases of 3 bottles; each case is listed with its contents, item by item, beneath it.'
                : ''
            }${cur === 'AED' ? ` All values in AED, converted from USD at the fixed rate of AED ${doc.header.rate} = USD 1.` : ''}${
              doc.header.grossWeightEstimated && doc.header.grossWeightKg !== null ? ' Gross weight is estimated.' : ''
            }`}
          </Text>
          {doc.notes.map((n) => (
            <Text key={n} style={styles.small}>{n}</Text>
          ))}
          <View style={styles.footer}>
            <Text style={{ fontSize: 7, color: '#444444' }}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>Declaration: </Text>
              {doc.declaration}
            </Text>
            <View style={styles.signRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.signBox}>
                  <Text style={styles.signHint}>Authorised signature &amp; company stamp</Text>
                </View>
                <Text style={{ fontSize: 7, textAlign: 'center', marginTop: 3, fontFamily: 'Helvetica-Bold' }}>
                  Authorised Signature &amp; Company Stamp — Craft &amp; Culture FZE
                </Text>
              </View>
              <View style={styles.signFields}>
                <Text style={styles.signField}>Name:</Text>
                <Text style={styles.signField}>Date:</Text>
              </View>
            </View>
          </View>
        </View>

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${doc.header.number ?? 'DRAFT'} · Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
};

export default ExportInvoicePDFTemplate;
