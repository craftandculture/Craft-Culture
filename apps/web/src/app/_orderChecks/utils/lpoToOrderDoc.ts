import type { ParsedLpo } from '@/app/_lpo/utils/parseLpoText';

import type { OrderDoc } from './compareOrderDocuments';

/**
 * A parsed client LPO, in the form every order document is compared in
 *
 * The LPO pipeline already reasons in bottles and AED, so this only renames.
 * The client's own wording for each wine is kept: it is matched against ours,
 * never replaced by it.
 *
 * @example
 *   lpoToOrderDoc(parseAnyLpoText(text)).number; // '8828'
 *
 * @param lpo - A purchase order as `_lpo` reads it
 * @returns The LPO as an `OrderDoc`
 */
const lpoToOrderDoc = (lpo: ParsedLpo): OrderDoc => ({
  kind: 'lpo',
  number: lpo.poNumber ?? 'without number',
  customerName: lpo.client,
  reference: lpo.poNumber,
  currency: 'AED',
  total: lpo.declaredTotalAed ?? lpo.computedTotalAed,
  terms: lpo.creditTerms,
  lines: lpo.lines.map((line) => ({
    name: line.wine,
    code: line.lwin18 ?? null,
    vintage: line.vintage.trim() || null,
    sizeMl: line.sizeMl || null,
    pack: line.pack ?? null,
    bottles: line.bottles,
    perBottle: line.unitPriceAed,
    lineTotal: line.lineTotalAed,
  })),
});

export default lpoToOrderDoc;
