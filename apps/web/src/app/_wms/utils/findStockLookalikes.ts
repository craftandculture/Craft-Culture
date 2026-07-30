import { gt } from 'drizzle-orm';

import { wmsStock } from '@/database/schema';

/** Articles/prepositions that carry no distinguishing signal in a wine name. */
const STOPWORDS = new Set([
  'the',
  'di',
  'de',
  'du',
  'da',
  'la',
  'le',
  'les',
  'des',
  'of',
  'and',
]);

/** Significant lowercase tokens of a product name (drops pack suffix, punctuation, stopwords). */
const tokenize = (name: string) =>
  new Set(
    name
      .toLowerCase()
      .replace(/\(\d+x\)/g, ' ') // drop "(5x)" pack suffix
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t)),
  );

const lwin7Of = (lwin18: string) => lwin18.split('-')[0] ?? lwin18.slice(0, 7);

export interface LookalikeWine {
  lwin18: string;
  productName: string;
  vintage: number | null;
}

/**
 * Find pairs of DIFFERENT wines in stock (different LWIN7) whose names are
 * confusingly similar — the picking-error trap (e.g. "Talenti, Brunello di
 * Montalcino" vs "Talenti, Piero, Brunello di Montalcino").
 *
 * Two in-stock wines are flagged as lookalikes when they share the SAME vintage
 * and one's significant name-tokens are a strict SUBSET of the other's — i.e. the
 * names are identical except for an extra word (the "Piero" trap). This is kept
 * deliberately high-precision: same-producer siblings that are clearly different
 * (e.g. Mezcal Blanco vs Reposado) are NOT flagged, to avoid alert fatigue.
 * Same-vintage is required because a different year is an obvious visual tell.
 *
 * @returns byLwin18 (each wine → its lookalikes) and the flat list of pairs.
 */
const findStockLookalikes = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
) => {
  const rows: { lwin18: string; productName: string; vintage: number | null }[] =
    await db
      .select({
        lwin18: wmsStock.lwin18,
        productName: wmsStock.productName,
        vintage: wmsStock.vintage,
      })
      .from(wmsStock)
      .where(gt(wmsStock.quantityCases, 0))
      .groupBy(wmsStock.lwin18, wmsStock.productName, wmsStock.vintage);

  // Bucket by vintage; only compare same-year wines.
  const byVintage = new Map<string, (LookalikeWine & { lwin7: string; toks: Set<string> })[]>();
  for (const r of rows) {
    const key = String(r.vintage ?? 'nv');
    const entry = {
      lwin18: r.lwin18,
      productName: r.productName,
      vintage: r.vintage,
      lwin7: lwin7Of(r.lwin18),
      toks: tokenize(r.productName),
    };
    const arr = byVintage.get(key);
    if (arr) arr.push(entry);
    else byVintage.set(key, [entry]);
  }

  const byLwin18: Record<string, LookalikeWine[]> = {};
  const pairs: { a: LookalikeWine; b: LookalikeWine }[] = [];

  for (const group of byVintage.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]!;
        const b = group[j]!;
        // Same wine (different pack) is not a lookalike.
        if (a.lwin7 === b.lwin7) continue;
        if (a.toks.size < 2 || b.toks.size < 2) continue;

        const inter = [...a.toks].filter((t) => b.toks.has(t)).length;
        const smaller = Math.min(a.toks.size, b.toks.size);
        // One name's tokens fully contained in the other's = near-identical name
        // ± an extra word. High-precision signal for a genuine picking trap.
        const isSubset = inter === smaller;

        if (isSubset) {
          const aw: LookalikeWine = { lwin18: a.lwin18, productName: a.productName, vintage: a.vintage };
          const bw: LookalikeWine = { lwin18: b.lwin18, productName: b.productName, vintage: b.vintage };
          (byLwin18[a.lwin18] ??= []).push(bw);
          (byLwin18[b.lwin18] ??= []).push(aw);
          pairs.push({ a: aw, b: bw });
        }
      }
    }
  }

  return { byLwin18, pairs };
};

export default findStockLookalikes;
