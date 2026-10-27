import pairOrderLines, { nameScore } from './pairOrderLines';
import parseTermsDays from './parseTermsDays';

export type OrderDocKind = 'lpo' | 'sales_order' | 'invoice';

/** One line of any order document, in the units every document can be compared in */
export interface OrderDocLine {
  name: string;
  /** Our LWIN-18, where the document carries one */
  code?: string | null;
  /** Four digits or "NV"; null where the line does not say */
  vintage: string | null;
  sizeMl: number | null;
  /** Bottles per case, where stated */
  pack: number | null;
  bottles: number | null;
  /** Price per bottle in the document's currency */
  perBottle: number | null;
  lineTotal: number | null;
}

/** A client LPO, sales order or invoice, reduced to what is compared */
export interface OrderDoc {
  kind: OrderDocKind;
  number: string;
  customerName: string | null;
  /** The client's reference as printed: the invoice's "P.O.#", the order's reference */
  reference: string | null;
  currency: string | null;
  total: number | null;
  /** Payment terms as the document states them */
  terms: string | null;
  /** Free text printed on the document (terms and conditions, notes) */
  printedText?: string | null;
  /** How the document records the sale, where it says */
  saleType?: 'consignment' | 'sale' | null;
  lines: OrderDocLine[];
}

export type FindingLevel = 'error' | 'warning' | 'info';

export interface OrderFinding {
  level: FindingLevel;
  code: string;
  /** "Invoice INV-000422" */
  document: string;
  /** "Header", "Terms", "Line 2 · Elio Grasso, Barolo 2018" */
  where: string;
  message: string;
}

export interface MatchedLine {
  name: string;
  vintage: string | null;
  sizeMl: number | null;
  bottles: number | null;
  perBottle: number | null;
  lineTotal: number | null;
}

const KIND_LABEL: Record<OrderDocKind, string> = { lpo: 'LPO', sales_order: 'Sales order', invoice: 'Invoice' };

export const docLabel = (doc: OrderDoc) => `${KIND_LABEL[doc.kind]} ${doc.number}`;

const same = (x: number, y: number) => Math.abs(x - y) <= Math.max(0.01, Math.abs(y) * 0.0005);

const fmt = (n: number | null, currency?: string | null) =>
  n === null
    ? 'nothing'
    : `${currency ? `${currency} ` : ''}${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const lineWhere = (line: OrderDocLine, index: number) =>
  `Line ${index + 1} · ${line.name}${line.vintage && !line.name.includes(line.vintage) ? ` ${line.vintage}` : ''}`;

const squash = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b(fz-?llc|fze|llc|l\.l\.c|ltd|limited|trading|general|co)\b/g, '')
    .replace(/[^a-z0-9]/g, '');

/** Several invoices against one order are compared as one, line for line */
const combineInvoices = (invoices: OrderDoc[]): OrderDoc => {
  const first = invoices[0]!;
  if (invoices.length === 1) return first;
  return {
    ...first,
    number: invoices.map((i) => i.number).join(', '),
    total: invoices.every((i) => i.total !== null) ? invoices.reduce((s, i) => s + (i.total ?? 0), 0) : null,
    lines: invoices.flatMap((i) => i.lines),
  };
};

/**
 * Compare a client's LPO with our sales order and invoices, line by line
 *
 * Each document is checked against the one before it in the chain the order
 * actually follows: the LPO is what the client asked for, the sales order is
 * what we booked, the invoice is what we bill. A difference is reported on the
 * later document, naming the line and what each side says, so the person
 * fixing it knows exactly where to go.
 *
 * Nothing is assumed to match. A line without a confident partner is reported
 * as missing or extra; a missing document makes the order "awaiting", never
 * "matched", so an incomplete check cannot pass for a complete one. Nothing is
 * changed in Zoho: this reports, and a person decides.
 *
 * @example
 *   compareOrderDocuments({ lpo, salesOrder, invoices: [invoice] }).status; // 'review'
 *
 * @param docs - The client LPO, our sales order and its invoices; any may be missing
 * @returns A status, what is still awaited, every finding, and the lines that agree
 */
const compareOrderDocuments = ({
  lpo,
  salesOrder,
  invoices,
}: {
  lpo: OrderDoc | null;
  salesOrder: OrderDoc | null;
  invoices: OrderDoc[];
}) => {
  const findings: OrderFinding[] = [];
  const add = (level: FindingLevel, code: string, document: string, where: string, message: string) =>
    findings.push({ level, code, document, where, message });

  const awaiting = [
    ...(lpo ? [] : ['Client LPO']),
    ...(salesOrder ? [] : ['Sales order']),
    ...(invoices.length ? [] : ['Invoice']),
  ];

  const invoice = invoices.length ? combineInvoices(invoices) : null;
  const chain = [lpo, salesOrder, invoice].filter((d): d is OrderDoc => d !== null);
  const root = chain[0] ?? null;

  /* The same wine twice on one document */
  for (const doc of [lpo, salesOrder, ...invoices].filter((d): d is OrderDoc => d !== null)) {
    doc.lines.forEach((line, i) => {
      const earlier = doc.lines.findIndex(
        (other, j) =>
          j < i &&
          other.vintage === line.vintage &&
          other.sizeMl === line.sizeMl &&
          (line.code && other.code ? line.code === other.code : nameScore(line.name, other.name) === 1),
      );
      if (earlier >= 0) {
        add('warning', 'DUPLICATE_LINE', docLabel(doc), lineWhere(line, i), `Same wine as line ${earlier + 1}`);
      }
    });
  }

  /*
    Lines, one link of the chain at a time. `clean` follows the root
    document's lines through each link, so a line counts as matched only when
    it agrees on every document it reaches.
  */
  const clean = new Map<number, number>(root ? root.lines.map((_, i) => [i, i]) : []);

  for (let k = 1; k < chain.length; k += 1) {
    const base = chain[k - 1]!;
    const other = chain[k]!;
    const { pairs, onlyInA, onlyInB } = pairOrderLines(base.lines, other.lines);
    const ok = new Map<number, number>();

    for (const p of pairs) {
      const a = base.lines[p.a]!;
      const b = other.lines[p.b]!;
      const where = lineWhere(b, p.b);
      let lineOk = true;

      if (a.bottles !== null && b.bottles !== null && a.bottles !== b.bottles) {
        add('error', 'QTY_DIFFERS', docLabel(other), where, `${b.bottles} bottles here, ${a.bottles} on ${docLabel(base)}`);
        lineOk = false;
      }
      if (a.pack && b.pack && a.pack !== b.pack) {
        add('warning', 'PACK_DIFFERS', docLabel(other), where, `${b.pack} per case here, ${a.pack} per case on ${docLabel(base)}`);
        lineOk = false;
      }
      if (a.perBottle !== null && b.perBottle !== null && base.currency === other.currency && !same(a.perBottle, b.perBottle)) {
        add(
          'error',
          'PRICE_DIFFERS',
          docLabel(other),
          where,
          `${fmt(b.perBottle, other.currency)} a bottle here, ${fmt(a.perBottle, base.currency)} on ${docLabel(base)}`,
        );
        lineOk = false;
      }
      if (a.lineTotal !== null && b.lineTotal !== null && base.currency === other.currency && !same(a.lineTotal, b.lineTotal)) {
        add(
          'error',
          'LINE_TOTAL_DIFFERS',
          docLabel(other),
          where,
          `Line total ${fmt(b.lineTotal, other.currency)} here, ${fmt(a.lineTotal, base.currency)} on ${docLabel(base)}`,
        );
        lineOk = false;
      }
      if (lineOk) ok.set(p.a, p.b);
    }

    for (const i of onlyInA) {
      add('error', 'LINE_MISSING', docLabel(other), lineWhere(base.lines[i]!, i).replace(/^Line \d+/, `${docLabel(base)} line ${i + 1}`), `On ${docLabel(base)} but not on ${docLabel(other)}`);
    }
    for (const j of onlyInB) {
      add('error', 'LINE_EXTRA', docLabel(other), lineWhere(other.lines[j]!, j), `Not on ${docLabel(base)}`);
    }

    for (const [rootIndex, at] of [...clean.entries()]) {
      const next = ok.get(at);
      if (next === undefined) clean.delete(rootIndex);
      else clean.set(rootIndex, next);
    }
  }

  /* Totals and currency, each document against the first */
  if (root) {
    for (const doc of chain.slice(1)) {
      if (root.currency && doc.currency && root.currency !== doc.currency) {
        add('error', 'CURRENCY_DIFFERS', docLabel(doc), 'Header', `In ${doc.currency}; ${docLabel(root)} is in ${root.currency}`);
      } else if (root.total !== null && doc.total !== null && !same(root.total, doc.total)) {
        add('error', 'TOTAL_DIFFERS', docLabel(doc), 'Totals', `Total ${fmt(doc.total, doc.currency)}; ${docLabel(root)} totals ${fmt(root.total, root.currency)}`);
      }
    }
  }

  /* Printed wording that contradicts the document's own currency */
  for (const doc of [salesOrder, ...invoices].filter((d): d is OrderDoc => d !== null)) {
    const text = (doc.printedText ?? '').toLowerCase();
    const said = /payment\s+(?:to be made\s+)?in\s+(usd|aed|eur|gbp)/.exec(text)?.[1]?.toUpperCase();
    if (said && doc.currency && said !== doc.currency) {
      add('warning', 'CURRENCY_WORDING', docLabel(doc), 'Terms', `Printed terms say "Payment in ${said}", but the document is in ${doc.currency}`);
    }
  }

  /* The client's LPO number on our documents */
  if (lpo?.number) {
    const n = lpo.number.replace(/^0+/, '');
    // An LPO number may hold characters a pattern treats as special (".", "(", "+")
    const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const carries = (ref: string | null) => !!ref && new RegExp(`(^|\\D)0*${escaped}(\\D|$)`).test(ref);
    if (salesOrder && !carries(salesOrder.reference)) {
      add('warning', 'LPO_REF_MISSING', docLabel(salesOrder), 'Reference', `Reference reads "${salesOrder.reference || 'nothing'}"; it should carry LPO ${lpo.number}`);
    }
    for (const inv of invoices) {
      if (!carries(inv.reference)) {
        add(
          'error',
          'LPO_REF_MISSING',
          docLabel(inv),
          'P.O.# / reference',
          `Reads "${inv.reference || 'nothing'}"; the client's LPO number ${lpo.number} must be on the invoice`,
        );
      }
    }
  }

  /* Customer */
  if (lpo?.customerName && salesOrder?.customerName) {
    const a = squash(lpo.customerName);
    const b = squash(salesOrder.customerName);
    if (a && b && !a.includes(b) && !b.includes(a)) {
      add('warning', 'CUSTOMER_DIFFERS', docLabel(salesOrder), 'Customer', `Billed to ${salesOrder.customerName}; the LPO is from ${lpo.customerName}`);
    }
  }
  if (salesOrder?.customerName) {
    for (const inv of invoices) {
      if (inv.customerName && squash(inv.customerName) !== squash(salesOrder.customerName)) {
        add('error', 'CUSTOMER_DIFFERS', docLabel(inv), 'Customer', `Billed to ${inv.customerName}; the sales order is for ${salesOrder.customerName}`);
      }
    }
  }

  /* Payment terms against what the client's LPO states */
  const lpoTerms = parseTermsDays(lpo?.terms);
  for (const inv of invoices) {
    const invTerms = parseTermsDays(inv.terms);
    if (lpoTerms && invTerms && (lpoTerms.endOfMonth !== invTerms.endOfMonth || lpoTerms.days !== invTerms.days)) {
      add('warning', 'TERMS_DIFFER', docLabel(inv), 'Payment terms', `Invoice: ${invTerms.label} ("${inv.terms}"). LPO: ${lpoTerms.label}.`);
    } else if (lpoTerms && !invTerms && inv.terms) {
      add('info', 'TERMS_UNREAD', docLabel(inv), 'Payment terms', `Could not read "${inv.terms}" as a credit period; LPO says ${lpoTerms.label}`);
    }
  }

  /* Consignment or sale, recorded the same way throughout */
  const types = [salesOrder, ...invoices].filter((d): d is OrderDoc => !!d?.saleType);
  if (new Set(types.map((d) => d.saleType)).size > 1) {
    add(
      'warning',
      'SALE_TYPE_DIFFERS',
      types.map(docLabel).join(' / '),
      'Sale type',
      types.map((d) => `${docLabel(d)}: ${d.saleType === 'consignment' ? 'consignment' : 'regular sale'}`).join('; '),
    );
  }

  const matched: MatchedLine[] = root
    ? [...clean.keys()].map((i) => {
        const l = root.lines[i]!;
        return { name: l.name, vintage: l.vintage, sizeMl: l.sizeMl, bottles: l.bottles, perBottle: l.perBottle, lineTotal: l.lineTotal };
      })
    : [];

  const counts = {
    error: findings.filter((f) => f.level === 'error').length,
    warning: findings.filter((f) => f.level === 'warning').length,
    info: findings.filter((f) => f.level === 'info').length,
  };

  const status: 'awaiting' | 'review' | 'matched' =
    awaiting.length > 0 ? 'awaiting' : counts.error + counts.warning > 0 ? 'review' : 'matched';

  return {
    status,
    awaiting,
    findings,
    matched,
    totalLines: root?.lines.length ?? 0,
    counts,
    saleType: types[0]?.saleType ?? null,
  };
};

export default compareOrderDocuments;
