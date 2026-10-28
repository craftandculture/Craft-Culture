/** Words that say nothing about which wine it is */
const NOISE = new Set(
  [
    'domaine dom chateau ch maison cave caves tenuta bodega bodegas weingut cantina de des du',
    'la le les el di del della and et e the of von van aoc aop igt doc docg do vdp grand cru',
    'premier 1er vin wine red white rouge blanc nv bt btl magnum mag cl ml l case owc oc',
  ]
    .join(' ')
    .split(' '),
);

/**
 * The distinctive words of a wine name: lower case, accents and punctuation
 * gone, vintages, sizes and words like "Domaine" or "Grand Cru" dropped
 */
const wordsOf = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(
      (word) => word.length > 1 && !NOISE.has(word) && !/^\d+$/.test(word),
    );

/**
 * How much of a reference wine name is found in ours, from 0 to 1
 *
 * Measured against the reference (the LWIN register's name), since our names
 * carry extra words of their own: pack, owner shorthand, vintage. A word counts
 * when it matches, or when one starts with the other ("Gevrey" and
 * "Gevrey-Chambertin" both read as "gevrey").
 *
 * @example
 *   nameOverlap('Antinori, Solaia, IGT 2016', 'Antinori, Solaia'); // 1
 *   nameOverlap(
 *     'Fourrier Gevrey-Chambertin',
 *     'Domaine Fourrier, Griotte-Chambertin',
 *   ); // 0.67
 *
 * @param ours - Our product name
 * @param reference - The name to check it against
 * @returns The share of the reference's words found in ours; 0 when it has none
 */
const nameOverlap = (ours: string, reference: string) => {
  const mine = wordsOf(ours);
  const theirs = [...new Set(wordsOf(reference))];
  if (!theirs.length) return 0;
  const found = theirs.filter((word) =>
    mine.some(
      (own) =>
        own === word ||
        (Math.min(own.length, word.length) >= 4 &&
          (own.startsWith(word) || word.startsWith(own))),
    ),
  );
  return found.length / theirs.length;
};

export default nameOverlap;
