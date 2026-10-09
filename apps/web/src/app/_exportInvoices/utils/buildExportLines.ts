import { PCO_CASE_BOTTLES } from '../constants';
import classifyHsCode from './classifyHsCode';
import cleanDescription from './cleanDescription';
import parsePack from './parsePack';
import priceLine from './priceLine';
import roundMoney from './roundMoney';
import type {
  ExportBoeCandidate,
  ExportLine,
  ExportSection,
} from '../schemas/exportDocumentSchema';

/** One invoice, as fetched from Zoho and reduced to what an export needs */
export interface ExportInvoiceInput {
  zohoInvoiceId: string;
  invoiceNumber: string;
  soNumber: string | null;
  pcoNumber: string | null;
  invoiceDate: string;
  totalUsd: number;
  lines: {
    lineItemId: string;
    name: string;
    description: string;
    lwin18: string | null;
    quantity: number;
    rate: number;
    /** The line's billed amount, after any discount */
    netUsd: number;
    zohoHsCode: string | null;
  }[];
}

/** Where a line's stock came from, keyed `${soNumber}|${lwin18}` */
export interface ExportBoeLookup {
  boe: string | null;
  ownerName: string | null;
  candidates: ExportBoeCandidate[];
}

export interface BuildExportLinesOptions {
  rate: number;
  originByLwin: Map<string, string>;
  boeByKey: Map<string, ExportBoeLookup>;
  ownerByInvoice?: Map<string, string>;
}

/**
 * Turn Zoho invoices into the sections and lines of an export invoice
 *
 * Pure, so it can be replayed against the export invoices that were built by
 * hand. Each ordinary invoice is one section, line for line. PCO orders are
 * packed in mixed cartons of three, so their bottles are chunked into cases in
 * invoice order, and orders with an identical selection share a section with
 * qty = number of orders. Either way every line is counted in cartons.
 *
 * @param invoices - The invoices, in the order they should print
 * @param options - Exchange rate and enrichment looked up beforehand
 * @returns Sections and lines
 */
const buildExportLines = (invoices: ExportInvoiceInput[], options: BuildExportLinesOptions) => {
  const { rate, originByLwin, boeByKey, ownerByInvoice } = options;
  const sections: ExportSection[] = [];
  const lines: ExportLine[] = [];

  const originFor = (lwin18: string | null) =>
    (lwin18 && (originByLwin.get(lwin18) ?? originByLwin.get(lwin18.slice(0, 7)))) ?? '';
  const boeFor = (inv: ExportInvoiceInput, lwin18: string | null): ExportBoeLookup =>
    (lwin18 && boeByKey.get(`${inv.soNumber ?? inv.invoiceNumber}|${lwin18}`)) || {
      boe: null,
      ownerName: null,
      candidates: [],
    };
  const ref = (inv: ExportInvoiceInput) => ({
    invoiceNumber: inv.invoiceNumber,
    soNumber: inv.soNumber,
    pcoNumber: inv.pcoNumber,
  });

  // Ordinary invoices: one section each, one line per invoice line
  for (const inv of invoices.filter((i) => !i.pcoNumber)) {
    const sectionId = `s${sections.length + 1}`;
    sections.push({ id: sectionId, refs: [ref(inv)], note: null });
    for (const l of inv.lines) {
      const text = `${l.description} ${l.name}`;
      const pack = parsePack(text) ?? { packBottles: 1, bottleSizeCl: 75 };
      const priced = priceLine(l.netUsd, l.quantity, rate);
      const boe = boeFor(inv, l.lwin18);
      lines.push({
        id: `l${lines.length + 1}`,
        sectionId,
        kind: 'cased',
        description: cleanDescription(l.name),
        hsCode: classifyHsCode(text, l.zohoHsCode),
        origin: originFor(l.lwin18),
        packBottles: pack.packBottles,
        bottleSizeCl: pack.bottleSizeCl,
        qty: l.quantity,
        ...priced,
        components: [],
        boe: boe.boe,
        boeCandidates: boe.candidates,
        boeOwnerName: boe.ownerName,
        source: {
          invoiceNumbers: [inv.invoiceNumber],
          zohoLineItemIds: [l.lineItemId],
          netUsd: l.netUsd,
          lwin18: l.lwin18,
          ownerName: ownerByInvoice?.get(inv.invoiceNumber) ?? null,
        },
        extra: {},
        override: null,
      });
    }
  }

  // PCO orders: group identical selections, then pack into cartons of three
  const groups = new Map<string, ExportInvoiceInput[]>();
  for (const inv of invoices.filter((i) => i.pcoNumber)) {
    // The same selection is often keyed in a different line order
    const key = JSON.stringify(
      inv.lines.map((l) => [l.name.trim().toLowerCase(), l.quantity, l.rate, l.netUsd]).sort(),
    );
    groups.set(key, [...(groups.get(key) ?? []), inv]);
  }

  for (const orders of groups.values()) {
    const first = orders[0];
    if (!first) continue;
    const n = orders.length;
    const sectionId = `s${sections.length + 1}`;
    const bottles = first.lines.reduce((s, l) => s + l.quantity * (parsePack(`${l.description} ${l.name}`)?.packBottles ?? 1), 0);
    const cases = Math.ceil(bottles / PCO_CASE_BOTTLES);
    sections.push({
      id: sectionId,
      refs: orders.map(ref),
      note: `${n > 1 ? `${n} × ` : ''}${bottles} btl, ${cases * n} cs`,
    });

    // One entry per bottle, in invoice order
    const units = first.lines.flatMap((l) => {
      const text = `${l.description} ${l.name}`;
      const pack = parsePack(text) ?? { packBottles: 1, bottleSizeCl: 75 };
      const perBottleUsd = l.netUsd / (l.quantity * pack.packBottles);
      return Array.from({ length: l.quantity * pack.packBottles }, () => ({
        line: l,
        text,
        sizeCl: pack.bottleSizeCl,
        perBottleUsd,
      }));
    });

    /*
      Cartons with the same contents are one line, qty counting them. Packing
      bottle by bottle made every carton its own line, so an order of twelve
      Fournier came out as four "mixed cases" each listing the same wine three
      times — EXP-2026-0046 ran to four pages of it.
    */
    const merged = new Map<string, ExportLine>();

    for (let i = 0; i < units.length; i += PCO_CASE_BOTTLES) {
      const chunk = units.slice(i, i + PCO_CASE_BOTTLES);
      const components = chunk.map((u) => ({
        description: cleanDescription(u.line.name),
        origin: originFor(u.line.lwin18),
        hsCode: classifyHsCode(u.text, u.line.zohoHsCode),
        unitPrice: roundMoney(u.perBottleUsd * rate),
        lwin18: u.line.lwin18,
      }));
      const names = [...new Set(components.map((c) => c.description))];
      const unitPrice = roundMoney(components.reduce((s, c) => s + c.unitPrice, 0));
      const lookups = orders.flatMap((o) => chunk.map((u) => boeFor(o, u.line.lwin18)));
      const boes = [...new Set(lookups.map((b) => b.boe).filter(Boolean))];
      const hsCodes = [...new Set(chunk.map((u) => classifyHsCode(u.text, u.line.zohoHsCode)))];
      const wines = new Set(components.map((c) => `${c.description}|${c.lwin18 ?? ''}`));

      const signature = JSON.stringify([
        components.map((c) => [c.description, c.lwin18, c.hsCode, c.origin, c.unitPrice]),
        boes,
      ]);
      const twin = merged.get(signature);
      if (twin) {
        twin.qty += n;
        twin.amount = roundMoney(twin.unitPrice * twin.qty);
        twin.source.netUsd = roundMoney(
          twin.source.netUsd + chunk.reduce((s, u) => s + u.perBottleUsd, 0) * n,
        );
        continue;
      }

      const line: ExportLine = {
        id: `l${lines.length + 1}`,
        sectionId,
        /* One wine in the carton is a case of that wine, not a "mixed" one */
        kind: wines.size === 1 ? 'cased' : 'mixedCase',
        description: names.length === 1 ? (names[0] ?? '') : `Mixed case: ${names.join('; ')}`,
        hsCode: hsCodes.length === 1 ? (hsCodes[0] ?? '') : hsCodes.join(' / '),
        origin: [...new Set(components.map((c) => c.origin).filter(Boolean))].join(' / '),
        packBottles: chunk.length,
        bottleSizeCl: chunk[0]?.sizeCl ?? 75,
        qty: n,
        unitPrice,
        amount: roundMoney(unitPrice * n),
        components,
        boe: boes.length === 1 ? (boes[0] ?? null) : null,
        boeCandidates: boes.length > 1 ? lookups.flatMap((b) => b.candidates) : [],
        boeOwnerName: lookups.find((b) => b.ownerName)?.ownerName ?? null,
        source: {
          invoiceNumbers: orders.map((o) => o.invoiceNumber),
          zohoLineItemIds: orders.flatMap((o) => o.lines.map((l) => l.lineItemId)),
          netUsd: roundMoney(chunk.reduce((s, u) => s + u.perBottleUsd, 0) * n),
          lwin18: null,
          ownerName: null,
        },
        extra: {},
        override: null,
      };
      lines.push(line);
      merged.set(signature, line);
    }
  }

  return { sections, lines };
};

export default buildExportLines;
