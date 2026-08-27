export interface DeclaredTotals {
  /** Full cases the document bills */
  cases: number | null;
  /** Loose bottles billed out of a pack */
  bottles: number | null;
  /** Physical cartons the goods travel in, however they were billed */
  cartons: number | null;
  pallets: number | null;
  /** The document's own grand total, in its own currency */
  value: number | null;
  /** The words it was read from, so a wrong reading can be argued with */
  source: string | null;
}

/**
 * Carton and pallet counts written as a sentence under the table.
 *
 * "12 cases on 1 pallet" is how a shipping note states what physically
 * travelled, and it is the only place that number appears — the line items
 * cannot yield it, because several bottle-billed lines are consolidated into
 * one mixed carton and only the packer knows how many.
 */
const CARTONS = /(\d+)\s*(?:cases?|cartons?|colis|packages?|pkgs?|boxes)\b/i;
const PALLETS = /(\d+)\s*(?:pallets?|skids?|palettes?)\b/i;

/**
 * Read a document's own declared totals
 *
 * Every extraction bug this flow has had — a 75,000ml bottle, a pack read as
 * 675, six invented cartons, thirteen false warnings — would have shown as a
 * single disagreement with a figure the supplier had already written down.
 * The document is the check on the parse, so its own totals are read rather
 * than discarded.
 *
 * The totals row is taken as the largest figure in each mapped column across
 * the rows that are not line items: a subtotal never exceeds the total it
 * belongs to. It is only ever shown to a person for confirmation, never
 * applied silently.
 *
 * @example
 *   parseDeclaredTotals({
 *     summaryRows: [{ cs: 11, bt: 10, 'Total Price': 31018.3 }],
 *     notes: ['12 cases on 1 pallet'],
 *     columns: { cases: 'cs', bottles: 'bt', value: 'Total Price' },
 *   });
 *   // { cases: 11, bottles: 10, cartons: 12, pallets: 1, value: 31018.3, … }
 *
 * @param input - The non-item rows, the text below the table, and which
 *   heading holds which figure
 * @returns What the document says it shipped
 */
const parseDeclaredTotals = ({
  summaryRows,
  notes,
  columns,
  toNumber,
}: {
  summaryRows: Record<string, unknown>[];
  notes: string[];
  columns: { cases?: string; bottles?: string; value?: string };
  toNumber: (value: unknown) => number | undefined;
}): DeclaredTotals => {
  const largest = (heading?: string) => {
    if (!heading) return null;

    const values = summaryRows
      .map((row) => toNumber(row[heading]))
      .filter((value): value is number => value != null && value > 0);

    return values.length > 0 ? Math.max(...values) : null;
  };

  const text = notes.join(' · ');
  const cartons = CARTONS.exec(text);
  const pallets = PALLETS.exec(text);

  const cases = largest(columns.cases);
  const bottles = largest(columns.bottles);
  const value = largest(columns.value);

  const readFrom = [
    cases != null || bottles != null || value != null
      ? 'the totals row'
      : null,
    cartons || pallets ? `"${text}"` : null,
  ].filter(Boolean);

  return {
    cases,
    bottles,
    cartons: cartons?.[1] ? Number(cartons[1]) : null,
    pallets: pallets?.[1] ? Number(pallets[1]) : null,
    value,
    source: readFrom.length > 0 ? readFrom.join(' and ') : null,
  };
};

export default parseDeclaredTotals;
