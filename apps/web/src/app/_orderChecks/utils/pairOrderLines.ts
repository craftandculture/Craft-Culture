import type { OrderDocLine } from './compareOrderDocuments';

/** Words that say nothing about which wine a line is */
const NOISE = new Set([
  'the', 'and', 'de', 'du', 'des', 'la', 'le', 'les', 'di', 'del', 'della', 'et', 'y',
  'chateau', 'château', 'domaine', 'tenuta', 'bodegas', 'cl', 'ml', 'case', 'cases', 'btl', 'bottle', 'bottles',
]);

/**
 * The words that identify a wine, as a set
 *
 * Vintages, sizes and packs are dropped: they are compared as fields, and left
 * in the name they would make "Barolo 2018 75CL" and "Barolo 2018 (6x75cl)"
 * look like different wines.
 */
export const nameTokens = (name: string) =>
  new Set(
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\d+\s*[x×]\s*\d+(?:\.\d+)?\s*(?:cl|ml|l)\b/g, ' ')
      .replace(/\b\d+(?:\.\d+)?\s*(?:cl|ml|l)\b/g, ' ')
      .replace(/\b(?:19|20)\d{2}\b/g, ' ')
      .split(/[^a-z]+/)
      .filter((w) => w.length > 1 && !NOISE.has(w)),
  );

/** Share of the shorter name's words that the other name also has */
export const nameScore = (a: string, b: string) => {
  const x = nameTokens(a);
  const y = nameTokens(b);
  if (x.size === 0 || y.size === 0) return 0;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared += 1;
  return shared / Math.min(x.size, y.size);
};

/** Below this, two names are not taken to be the same wine */
export const MIN_NAME_SCORE = 0.5;

/**
 * Pair each line of one document with the same wine on another
 *
 * Vintage and bottle size must agree where both documents state them: the same
 * wine in two years is two products at two prices, and a magnum reads almost
 * exactly like its 75cl sibling. Within that, the closest name wins, best pairs
 * first, and each line is used once. A product code on both sides is taken
 * before any name is scored.
 *
 * Nothing is forced. A line without a confident partner is returned unpaired,
 * so it is reported as missing or extra and looked at by a person, never
 * quietly matched to the nearest wine.
 *
 * @example
 *   pairOrderLines(lpo.lines, so.lines).pairs; // [{ a: 0, b: 1, score: 1 }]
 *
 * @param a - The reference document's lines
 * @param b - The lines to pair with them
 * @returns Pairs by index, and the indexes left unpaired on each side
 */
const pairOrderLines = (a: OrderDocLine[], b: OrderDocLine[]) => {
  const candidates: { a: number; b: number; score: number }[] = [];

  a.forEach((x, i) => {
    b.forEach((y, j) => {
      if (x.code && y.code && x.code === y.code) {
        candidates.push({ a: i, b: j, score: 2 });
        return;
      }
      if (x.vintage && y.vintage && x.vintage !== y.vintage) return;
      if (x.sizeMl && y.sizeMl && x.sizeMl !== y.sizeMl) return;
      const score = nameScore(x.name, y.name);
      if (score >= MIN_NAME_SCORE) candidates.push({ a: i, b: j, score });
    });
  });

  candidates.sort((p, q) => q.score - p.score);

  const usedA = new Set<number>();
  const usedB = new Set<number>();
  const pairs: { a: number; b: number; score: number }[] = [];

  for (const c of candidates) {
    if (usedA.has(c.a) || usedB.has(c.b)) continue;
    usedA.add(c.a);
    usedB.add(c.b);
    pairs.push(c);
  }

  return {
    pairs: pairs.sort((p, q) => p.a - q.a),
    onlyInA: a.map((_, i) => i).filter((i) => !usedA.has(i)),
    onlyInB: b.map((_, j) => j).filter((j) => !usedB.has(j)),
  };
};

export default pairOrderLines;
