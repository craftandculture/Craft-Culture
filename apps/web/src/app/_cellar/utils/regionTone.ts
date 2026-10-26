/** Each region in the colour of its wine, for its filter pill */
const TONES: [RegExp, string][] = [
  [/burgund|bourgogne|c[oô]te d|chablis/i, 'bg-rose-900 text-white'],
  [/bordeaux|pauillac|margaux|saint-[eé]milion|pomerol|saint-julien|pessac|sauternes/i, 'bg-red-800 text-white'],
  [/champagne/i, 'bg-yellow-700 text-white'],
  [/rh[oô]ne|ch[aâ]teauneuf|hermitage/i, 'bg-purple-800 text-white'],
  [/tuscan|toscan|bolgheri|montalcino|chianti/i, 'bg-sky-900 text-white'],
  [/piedmont|piemonte|barolo|barbaresco/i, 'bg-blue-800 text-white'],
  [/loire|alsace/i, 'bg-lime-800 text-white'],
  [/california|napa|sonoma|oregon|washington/i, 'bg-indigo-800 text-white'],
  [/spain|rioja|ribera|priorat/i, 'bg-orange-800 text-white'],
  [/germany|mosel|rheingau|austria/i, 'bg-amber-700 text-white'],
  [/australia|new zealand|south africa|chile|argentina/i, 'bg-emerald-800 text-white'],
  [/scotland|whisky|cognac|japan/i, 'bg-stone-700 text-white'],
];

/**
 * The colour a region's pill takes, so a list can be scanned by region
 *
 * @example
 *   regionTone('Burgundy'); // 'bg-rose-900 text-white'
 *
 * @param region - A region or country name as the catalogue holds it
 * @returns Tailwind classes for the pill
 */
const regionTone = (region: string) =>
  TONES.find(([pattern]) => pattern.test(region))?.[1] ?? 'bg-neutral-700 text-white';

export default regionTone;
