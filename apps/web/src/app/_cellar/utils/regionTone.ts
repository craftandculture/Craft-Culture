/** Each region in the colour of its wine, for the dot on its filter pill */
const TONES: [RegExp, string][] = [
  [/burgund|bourgogne|c[oô]te d|chablis/i, 'bg-rose-900'],
  [/bordeaux|pauillac|margaux|saint-[eé]milion|pomerol|saint-julien|pessac|sauternes/i, 'bg-red-800'],
  [/champagne/i, 'bg-yellow-700'],
  [/rh[oô]ne|ch[aâ]teauneuf|hermitage/i, 'bg-purple-800'],
  [/tuscan|toscan|bolgheri|montalcino|chianti/i, 'bg-sky-900'],
  [/piedmont|piemonte|barolo|barbaresco/i, 'bg-blue-800'],
  [/loire|alsace/i, 'bg-lime-800'],
  [/california|napa|sonoma|oregon|washington/i, 'bg-indigo-800'],
  [/spain|rioja|ribera|priorat/i, 'bg-orange-800'],
  [/germany|mosel|rheingau|austria/i, 'bg-amber-700'],
  [/australia|new zealand|south africa|chile|argentina/i, 'bg-emerald-800'],
  [/scotland|whisky|cognac|japan/i, 'bg-stone-700'],
];

/**
 * The colour of a region's dot, so a list can be scanned by region
 *
 * @example
 *   regionTone('Burgundy'); // 'bg-rose-900'
 *
 * @param region - A region or country name as the catalogue holds it
 * @returns The Tailwind background class for the dot
 */
const regionTone = (region: string) =>
  TONES.find(([pattern]) => pattern.test(region))?.[1] ?? 'bg-neutral-400';

export default regionTone;
