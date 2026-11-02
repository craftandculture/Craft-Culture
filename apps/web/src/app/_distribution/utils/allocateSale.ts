import { settles } from './classifyInvoice';
import type { InvoiceType } from './classifyInvoice';

export interface SaleLayer {
  arrangementId: string;
  lwin18: string | null;
  productName: string;
  docRef: string | null;
  docDate: string | null;
  bottles: number;
  invoiceType: InvoiceType | null;
}

export interface SaleShare {
  arrangementId: string;
  lwin18: string | null;
  productName: string;
  bottles: number;
  /** Bottles past every line we invoiced — sold, but nothing left to bill */
  short: boolean;
}

/**
 * The order bottles leave a wine's invoice lines in
 *
 * Stock the outlet already owns goes first: prepaid and outright lines before
 * any consignment line of the same wine, because what City Drinks have paid
 * for is what they sell before they start selling what they owe us for. Then
 * oldest first within each, by date and then invoice number.
 *
 * @param a - A layer
 * @param b - Another layer
 * @returns The sort order
 */
export const layerOrder = (
  a: Pick<SaleLayer, 'invoiceType' | 'docDate' | 'docRef'>,
  b: Pick<SaleLayer, 'invoiceType' | 'docDate' | 'docRef'>,
) => {
  const own = Number(settles(a.invoiceType)) - Number(settles(b.invoiceType));

  if (own !== 0) return own;

  const byDate = (a.docDate ?? '').localeCompare(b.docDate ?? '');

  if (byDate !== 0) return byDate;

  return (a.docRef ?? '').localeCompare(b.docRef ?? '');
};

/**
 * Split one month's sales of a wine across the invoice lines it came from
 *
 * One wine can reach City Drinks on several invoices under several owners —
 * Tignanello 2022 bought outright, the same wine consigned by C&C — and a
 * month's sales of it belong to whichever stock they actually drew down.
 * Earlier months have already eaten into each owner's oldest lines, so this
 * month starts where they finished — counted per arrangement, because the
 * bottles one owner sold never drew down another's.
 *
 * Bottles beyond every line are kept, not dropped, against the owner the
 * register names (or the last line's), and marked short: sold with no invoice
 * left to bill them against, which is a missing invoice or a wrong code and
 * needs a person.
 *
 * @example
 *   allocateSale(layers, 12, new Map([['cc', 6]]), null);
 *   // [{ arrangementId: 'own', bottles: 4 }, { arrangementId: 'cc', bottles: 8 }]
 *
 * @param layers - Every invoice line of the wine at this outlet, any owner
 * @param bottles - Bottles sold this month
 * @param alreadySold - Bottles of it each arrangement sold in earlier months
 * @param shortTo - The arrangement short bottles go to, when known
 * @returns The bottles each arrangement sold
 */
const allocateSale = (
  layers: SaleLayer[],
  bottles: number,
  alreadySold: ReadonlyMap<string, number>,
  shortTo: string | null,
) => {
  const ordered = [...layers].sort(layerOrder);
  const shares = new Map<string, SaleShare>();
  const toSkip = new Map(alreadySold);
  let remaining = bottles;

  for (const layer of ordered) {
    if (remaining <= 0) break;

    let available = layer.bottles;
    const skip = toSkip.get(layer.arrangementId) ?? 0;

    if (skip > 0) {
      const skipped = Math.min(skip, available);

      toSkip.set(layer.arrangementId, skip - skipped);
      available -= skipped;
    }

    if (available <= 0) continue;

    const take = Math.min(available, remaining);
    const existing = shares.get(layer.arrangementId);

    shares.set(layer.arrangementId, {
      arrangementId: layer.arrangementId,
      lwin18: existing?.lwin18 ?? layer.lwin18,
      productName: existing?.productName ?? layer.productName,
      bottles: (existing?.bottles ?? 0) + take,
      short: false,
    });
    remaining -= take;
  }

  const result = [...shares.values()];
  const last = ordered[ordered.length - 1];
  const target = shortTo ?? last?.arrangementId ?? null;

  if (remaining > 0 && target) {
    const sample = ordered.find((layer) => layer.arrangementId === target) ?? last;

    result.push({
      arrangementId: target,
      lwin18: sample?.lwin18 ?? null,
      productName: sample?.productName ?? '',
      bottles: remaining,
      short: true,
    });
  }

  return result;
};

export default allocateSale;
