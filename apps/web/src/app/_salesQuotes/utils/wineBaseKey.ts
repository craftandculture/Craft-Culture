/**
 * Reduce a wine name to a sort key so vintages of one wine group together.
 *
 * Strips the appellation suffix and classification words, so
 * "Chateau Latour 1er Cru Classe, Pauillac" and "Chateau Latour" agree.
 *
 * @example
 *   wineBaseKey('Chateau Latour 1er Cru Classe, Pauillac'); // 'chateau latour'
 *
 * @param name - The wine name
 * @returns The normalised sort key
 */
const wineBaseKey = (name: string) =>
  (name.split(',')[0] ?? name)
    .toLowerCase()
    .replace(/\b(1er|2eme|3eme|4eme|5eme|premier|grand|cru|classe)\b/g, ' ')
    .replace(/\s+[ab]\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export default wineBaseKey;
