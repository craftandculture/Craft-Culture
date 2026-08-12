import normalizeLwin18 from './normalizeLwin18';
import parseSkuPack from './parseSkuPack';
import rankStockByPack from './rankStockByPack';

export interface RepackStockRow {
  lwin18: string;
  productName: string;
  vintage: number | null;
  caseConfig: number | null;
  quantityCases: number;
  availableCases: number;
  locationCode: string | null;
}

export interface RepackLine {
  name: string;
  sku: string | null;
  description: string | null;
  /** Ordered quantity — cases, or bottles when the unit is a bottle. */
  quantity?: number | null;
  /** The Zoho line unit ('Case'/'Cases'/'Bottle'). */
  unit?: string | null;
}

/** Pack suffixes Zoho carries in line names that no stock name ever has. */
const PACK_SUFFIX =
  /\(\s*(?:single bottle|\d+\s*(?:x|pack|packs|bottles?|btl))\s*\)/gi;

/**
 * Drop diacritics so the same wine spelled either way is one wine:
 * `François Thienpont` in Zoho vs `Francois Thienpont` in stock.
 */
const deburr = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Strip the pack/vintage noise off a line or stock name so the two can be
 * compared on the wine itself.
 *
 * Underscores become spaces FIRST: a name like `Latour_1993` is one word to
 * both the vintage strip and the term split (`_` is a word character, so `\b`
 * never fires inside it), which left "latour_1993" as the search term and
 * matched no stock at all.
 */
const baseName = (name: string) =>
  name
    .replace(/_/g, ' ')
    .replace(PACK_SUFFIX, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/[,\s]+$/, '')
    .trim();

/**
 * Decide whether an order line needs a repack, and which bay to pick it from —
 * against stock rows already loaded by the caller.
 *
 * Splitting the matching out of the query lets a screen resolve many lines
 * against one stock fetch (the pick-list picker) while a single line can still
 * be resolved on its own (see resolveLineRepack). Stock is matched by LWIN
 * (pack-agnostic) OR product name + vintage, which catches pre-repacked packs
 * whose LWIN drifted from the order's.
 *
 * @example
 *   resolveRepackFromStock(rows, { name: 'Duroche …', sku: '1258617-2023-03-00750', description: '3x75cl' });
 *   // -> { orderedPack: 3, needsRepack: true, fromPack: 6, suggestedLocation: 'B-01-01', … }
 *
 * @param stock - Candidate stock rows (any wine; filtered here)
 * @param line - The order line to resolve
 * @returns The ordered pack, the repack decision and the suggested bay
 */
const resolveRepackFromStock = (stock: RepackStockRow[], line: RepackLine) => {
  // The SKU is the source of truth for the pack, but only when its pack digits
  // are plausible — see parseSkuPack. Otherwise the description ("6x75cl").
  const skuPack = parseSkuPack(line.sku)?.pack ?? 0;
  const packMatch = /^(\d+)\s*[x×]/i.exec(line.description ?? '');
  const descPack =
    packMatch && Number(packMatch[1]) > 0 ? Number(packMatch[1]) : 0;
  const orderedPack = skuPack > 0 ? skuPack : descPack > 0 ? descPack : 1;

  const normalized = normalizeLwin18(String(line.sku ?? ''));
  const parts = normalized.split('-');
  const lwin7 = parts[0] ?? '';
  const vintageStr =
    parts[1] ?? (line.name.match(/\b(19|20)\d{2}\b/)?.[0] ?? '');

  // LWIN's non-vintage codes. A mixed-vintage case (e.g. a 6-bottle
  // anniversary case spanning 2012-2017) is NV, and its stock row carries no
  // vintage — so an NV line has to match NV stock, not be dropped for having
  // no year to compare. '1000' must be caught HERE: Number('1000') is truthy,
  // so it would otherwise be compared as if the wine were vintage 1000.
  const isNonVintage = vintageStr === '0000' || vintageStr === '1000';
  const vintage = isNonVintage ? null : Number(vintageStr) || null;
  const rowIsNonVintage = (row: RepackStockRow) =>
    row.vintage == null || row.vintage === 0;

  const terms = baseName(line.name)
    .split(/[\s,\-]+/)
    .filter((term) => term.length > 2)
    .slice(0, 8)
    .map((term) => deburr(term).toLowerCase());

  // Any wine code, not just a 7-digit LWIN — stock received under a supplier
  // code (e.g. `W12008024-2021-06-00750`) is still the same wine in the same
  // bay, and the pack/size segments are what we're deliberately ignoring.
  const lwinPrefix =
    lwin7.length >= 3 && vintageStr && parts.length === 4
      ? `${lwin7}-${vintageStr}-`
      : null;

  // Gate on physical stock (quantityCases), NOT availableCases: a reserved
  // 6-pack is still a 6-pack that must be broken to fill a single.
  const candidates = stock.filter((row) => {
    if (row.quantityCases <= 0) return false;
    if (lwinPrefix && row.lwin18.startsWith(lwinPrefix)) return true;
    if (terms.length === 0) return false;
    // Vintage must agree before a name match is trusted — picking the wrong
    // year of the right label is worse than reporting no stock.
    if (vintage) {
      if (row.vintage !== vintage) return false;
    } else if (isNonVintage) {
      if (!rowIsNonVintage(row)) return false;
    } else {
      return false;
    }
    const haystack = deburr(row.productName).toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });

  const empty = {
    orderedPack,
    needsRepack: false,
    fromPack: null,
    mode: null,
    sourceCount: 0,
    hasStock: false,
    suggestedLocation: null,
  };

  if (candidates.length === 0) return empty;

  // Suggest the bay release-to-pick would actually choose: best pack fit that
  // holds ENOUGH, falling back to the best fit overall. Ranking alone would
  // point at a bay with one case when the line needs two, and the operator
  // would be sent somewhere else at release.
  const quantity = line.quantity ?? 1;
  const isBottleUnit = /^bottle/i.test((line.unit ?? '').trim());
  const orderedBottles = isBottleUnit ? quantity : quantity * orderedPack;
  const casesNeededFor = (pack: number) =>
    !isBottleUnit && pack === orderedPack
      ? quantity
      : Math.max(1, Math.ceil(orderedBottles / pack));

  const ranked = rankStockByPack(candidates, orderedPack);
  const suggestedLocation =
    (
      ranked.find(
        (row) =>
          row.availableCases >=
          casesNeededFor(
            row.caseConfig && row.caseConfig > 0 ? row.caseConfig : orderedPack,
          ),
      ) ?? ranked[0]
    )?.locationCode ?? null;

  const configs = [
    ...new Set(
      candidates
        .map((row) => row.caseConfig)
        .filter((config): config is number => config != null),
    ),
  ].sort((a, b) => a - b);

  if (configs.length === 0) return empty;

  if (configs.includes(orderedPack)) {
    return {
      orderedPack,
      needsRepack: false,
      fromPack: null,
      mode: null,
      sourceCount: 0,
      hasStock: true,
      suggestedLocation,
    };
  }

  const larger = configs.filter((config) => config > orderedPack);
  if (larger.length > 0) {
    // A larger pack on the shelf is broken DOWN (e.g. 6-pack → 3-pack).
    return {
      orderedPack,
      needsRepack: true,
      fromPack: Math.min(...larger),
      mode: 'break' as const,
      sourceCount: 1,
      hasStock: true,
      suggestedLocation,
    };
  }

  // Only smaller packs on the shelf → COMBINE them up to the ordered pack. You
  // cannot break a 3-pack into a 6.
  const fromPack = Math.max(...configs);
  return {
    orderedPack,
    needsRepack: true,
    fromPack,
    mode: 'combine' as const,
    sourceCount: Math.max(2, Math.ceil(orderedPack / fromPack)),
    hasStock: true,
    suggestedLocation,
  };
};

export default resolveRepackFromStock;
