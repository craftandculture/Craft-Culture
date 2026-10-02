import type { ExportDocument } from '../schemas/exportDocumentSchema';

/**
 * Collapse sorted numbers into ranges: 1, 2, 3, 5 → "1–3, 5"
 *
 * @param numbers - Ascending line numbers
 * @returns The range text
 */
const toRanges = (numbers: number[]) => {
  const out: string[] = [];
  let start = numbers[0];
  let prev = numbers[0];
  for (const n of [...numbers.slice(1), undefined]) {
    if (n !== undefined && prev !== undefined && n === prev + 1) {
      prev = n;
      continue;
    }
    if (start !== undefined && prev !== undefined) {
      out.push(start === prev ? `${start}` : `${start}–${prev}`);
    }
    start = n;
    prev = n;
  }
  return out.join(', ');
};

/**
 * Collapse consecutive invoice numbers: INV-000350, 351, 352 → "INV-000350–000352"
 *
 * @param invoices - Invoice numbers
 * @returns The compressed list
 */
const compressInvoices = (invoices: string[]) => {
  const parsed = invoices
    .map((inv) => ({ inv, m: inv.match(/^(.*?)(\d+)$/) }))
    .sort((a, b) => a.inv.localeCompare(b.inv));
  const out: string[] = [];
  let run: { prefix: string; width: number; start: number; end: number } | null = null;
  const flush = () => {
    if (!run) return;
    const pad = (n: number) => String(n).padStart(run?.width ?? 0, '0');
    out.push(run.start === run.end ? `${run.prefix}${pad(run.start)}` : `${run.prefix}${pad(run.start)}–${pad(run.end)}`);
    run = null;
  };
  for (const { inv, m } of parsed) {
    if (!m) {
      flush();
      out.push(inv);
      continue;
    }
    const prefix = m[1] ?? '';
    const digits = m[2] ?? '';
    const n = parseInt(digits, 10);
    if (run && run.prefix === prefix && n === run.end + 1) {
      run.end = n;
    } else {
      flush();
      run = { prefix, width: digits.length, start: n, end: n };
    }
  }
  flush();
  return out;
};

/**
 * Build the re-export BOE table from the lines
 *
 * One row per BOE, in order of first appearance, listing the invoices and the
 * line numbers it covers. Lines without a BOE are grouped under null so the
 * table shows the gap instead of hiding it.
 *
 * @param doc - The export document
 * @returns BOE rows
 */
const deriveBoeTable = (doc: ExportDocument) => {
  const rows = new Map<string, { invoices: Set<string>; lines: number[] }>();
  doc.lines.forEach((line, i) => {
    const key = line.boe ?? '';
    const row = rows.get(key) ?? { invoices: new Set<string>(), lines: [] };
    line.source.invoiceNumbers.forEach((inv) => row.invoices.add(inv));
    row.lines.push(i + 1);
    rows.set(key, row);
  });
  return [...rows.entries()].map(([boe, row]) => ({
    boe: boe || null,
    invoices: compressInvoices([...row.invoices]),
    lineRanges: toRanges(row.lines),
  }));
};

export default deriveBoeTable;
