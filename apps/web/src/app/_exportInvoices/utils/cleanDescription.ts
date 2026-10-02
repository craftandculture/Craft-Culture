/**
 * Tidy a Zoho item name for a customs document
 *
 * Item names carry their pack in brackets and sometimes a size and strength
 * tail ("(3x)", "(1x75cl)", "(6pk)", "0.75L 13.5%abv"). The pack has its own
 * column on the export invoice, so it is taken out of the description to stop
 * the two disagreeing when a line is repacked.
 *
 * @example
 *   cleanDescription('Chateau Potensac, Medoc 2021 (1x75cl)'); // 'Chateau Potensac, Medoc 2021'
 *
 * @param name - The Zoho item name
 * @returns The name without pack noise
 */
const cleanDescription = (name: string) =>
  name
    .replace(/\(\s*\d+\s*(?:x|pk|pack)\s*(?:\d+(?:\.\d+)?\s*(?:cl|ml|l))?\s*\)/gi, '')
    .replace(/\(\s*\d+\s*x\s*\d+(?:\.\d+)?\s*(?:cl|ml|l)\s*\)/gi, '')
    .replace(/\b\d+(?:\.\d+)?\s*l\s+\d+(?:\.\d+)?\s*%\s*abv\b/gi, '')
    .replace(/\b0?\.\d+\s*l\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,)])/g, '$1')
    .trim();

export default cleanDescription;
