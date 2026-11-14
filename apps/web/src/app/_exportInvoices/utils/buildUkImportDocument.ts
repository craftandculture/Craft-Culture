import {
  COLLECTION_POINT,
  DEFAULT_DECLARATION,
  EXPORTER,
  UK_BONDS,
  UK_EORI,
  UK_IMPORT_REASON,
} from '../constants';
import type { UkBondKey } from '../constants';
import classifyHsCode from './classifyHsCode';
import declareOrigins from './declareOrigins';
import estimateGrossWeight from './estimateGrossWeight';
import roundMoney from './roundMoney';
import type { ExportDocument, ExportLine, ExportSection } from '../schemas/exportDocumentSchema';

/** One supplier document, as read */
export interface UkImportSourceDoc {
  reference: string;
  supplier: string;
  date: string | null;
  currency: 'GBP' | 'USD';
  /** The document's own total, when it states one */
  statedTotal: number | null;
}

/** One line of wine, as read from a supplier document */
export interface UkImportReadLine {
  documentReference: string;
  description: string;
  country: string;
  region: string | null;
  packBottles: number;
  bottleSizeCl: number;
  /** Lots or cases of `packBottles` */
  cases: number;
  pricePerBottle: number | null;
  lineTotal: number | null;
  currency: 'GBP' | 'USD';
  dutyStatus: 'IB' | 'DP' | null;
  abv: string | null;
}

export interface UkImportOptions {
  bond: UkBondKey | { name: string; short: string; address: string };
  /** US dollars per pound, for GBP documents */
  gbpUsdRate: number;
  transport: 'Air Freight' | 'Sea Freight';
  portOfLoading: string;
  portOfDischarge: string;
  reason?: string;
  date: string;
}

const title = (s: string) => s.trim().replace(/\s+/g, ' ');

/**
 * Turn what was read from UK supplier documents into a UK import invoice
 *
 * The shape of the C&C (LCB) invoice of 27 Aug 2026 that customs cleared:
 * C&C's UK EORI ships from the bond to C&C FZE, values in USD converted from
 * GBP at the rate the operator gives, lines grouped by country and region,
 * duty status (IB / DP) and ABV per line, stamped with the UK EORI stamp.
 *
 * Qty is the number of lots of the stated pack, so a 5-bottle lot is one
 * line of 1 × 5x75cl, as it was on that invoice. The unit price is per lot,
 * so Qty × Unit = Amount holds as on every export invoice.
 *
 * @param docs - The supplier documents read
 * @param lines - Their wine lines
 * @param options - Bond, rate and shipment facts from the operator
 * @returns A draft document; nothing is saved
 */
const buildUkImportDocument = (
  docs: UkImportSourceDoc[],
  lines: UkImportReadLine[],
  options: UkImportOptions,
): ExportDocument => {
  const bond = typeof options.bond === 'string' ? UK_BONDS[options.bond] : options.bond;
  const fx = (currency: 'GBP' | 'USD') => (currency === 'GBP' ? options.gbpUsdRate : 1);

  // Grouped by country, then region, as the hand-built invoice was
  const groupOf = (l: UkImportReadLine) =>
    [title(l.country) || 'Origin to confirm', l.region ? title(l.region) : null].filter(Boolean).join(' — ');
  const groups = [...new Set(lines.map(groupOf))].sort((a, b) => a.localeCompare(b));

  const sections: ExportSection[] = groups.map((g, i) => ({ id: `s${i + 1}`, refs: [], note: g.toUpperCase() }));
  const sectionOf = new Map(groups.map((g, i) => [g, `s${i + 1}`]));

  const built: ExportLine[] = groups.flatMap((g) =>
    lines
      .filter((l) => groupOf(l) === g)
      .map((l) => {
        const pack = Math.max(1, Math.round(l.packBottles));
        const qty = Math.max(0, Math.round(l.cases));
        const bottles = pack * qty;
        const perBottle =
          l.pricePerBottle ?? (l.lineTotal !== null && bottles > 0 ? l.lineTotal / bottles : 0);
        const unitPrice = roundMoney(perBottle * pack * fx(l.currency));
        const amount = roundMoney(unitPrice * qty);
        return {
          id: '',
          sectionId: sectionOf.get(g) ?? 's1',
          kind: 'cased' as const,
          description: title(l.description),
          hsCode: classifyHsCode(l.description),
          origin: title(l.country),
          packBottles: pack,
          bottleSizeCl: l.bottleSizeCl > 0 ? l.bottleSizeCl : 75,
          qty,
          unitPrice,
          amount,
          components: [],
          boe: null,
          boeCandidates: [],
          boeOwnerName: null,
          source: {
            invoiceNumbers: [l.documentReference],
            zohoLineItemIds: [],
            netUsd: amount,
            lwin18: null,
            ownerName: null,
          },
          extra: {
            duty: l.dutyStatus ?? '',
            ...(l.abv ? { abv: l.abv } : {}),
          },
          override: null,
        };
      }),
  );
  built.forEach((l, i) => {
    l.id = `l${i + 1}`;
  });

  const casesBy = (status: 'IB' | 'DP') =>
    built.filter((l) => l.extra.duty === status).reduce((sum, l) => sum + l.qty, 0);
  const ib = casesBy('IB');
  const dp = casesBy('DP');
  const dutyStatus =
    ib > 0 && dp > 0
      ? `Mixed — ${dp} cases duty paid (DP), ${ib} cases in bond (IB). Status shown per line.`
      : ib > 0
        ? 'In bond (IB) — duty suspended'
        : dp > 0
          ? 'Duty paid (DP)'
          : 'To confirm per line';

  const allStated = docs.length > 0 && docs.every((d) => d.statedTotal !== null);
  const statedTotal = allStated
    ? roundMoney(docs.reduce((sum, d) => sum + (d.statedTotal ?? 0) * fx(d.currency), 0))
    : null;

  const notes: string[] = [];
  if ([...docs.map((d) => d.currency), ...lines.map((l) => l.currency)].includes('GBP')) {
    notes.push(`Values converted from GBP at GBP/USD ${options.gbpUsdRate}.`);
  }

  return {
    header: {
      kind: 'ukImport',
      number: null,
      date: options.date,
      exporter: {
        name: 'Craft and Culture',
        addressLines: [`Goods ex ${bond.name}`, '(see Export Details below)', 'United Kingdom'],
        trn: UK_EORI,
        idLabel: 'UK EORI',
      },
      consignee: EXPORTER,
      collection: COLLECTION_POINT,
      terms: `Ex Works (${bond.short})`,
      currency: 'USD',
      rate: 1,
      pallets: null,
      grossWeightKg: estimateGrossWeight(built, null),
      grossWeightEstimated: true,
      casesOverride: null,
      exportDetails: [
        { label: 'UK Exporter EORI', value: UK_EORI },
        { label: 'Duty Status', value: dutyStatus },
        { label: 'Country of Export', value: 'United Kingdom' },
        { label: 'Country of Destination', value: 'United Arab Emirates' },
        { label: 'Port of Loading', value: options.portOfLoading },
        { label: 'Port of Discharge', value: options.portOfDischarge },
        { label: 'Mode of Transport', value: options.transport },
        { label: options.transport === 'Sea Freight' ? 'Bill of Lading' : 'AWB Number', value: 'To be advised' },
        { label: 'Collection Address', value: bond.address },
        { label: 'Reason for Export', value: options.reason?.trim() || UK_IMPORT_REASON },
      ],
      referenceDocs: docs.map((d) =>
        [d.supplier, d.reference].filter(Boolean).join(' ') + (d.date ? ` (${d.date})` : ''),
      ),
      statedTotal,
      stamp: 'ukEori',
    },
    sources: [],
    sections,
    lines: built,
    extraColumns: [
      { key: 'duty', label: 'Duty' },
      ...(built.some((l) => l.extra.abv) ? [{ key: 'abv', label: 'ABV' }] : []),
    ],
    notes,
    declaration: declareOrigins(DEFAULT_DECLARATION, built),
  };
};

export default buildUkImportDocument;
