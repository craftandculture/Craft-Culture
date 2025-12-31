/**
 * Extract vintage year from a wine product name
 *
 * Looks for 4-digit years between 1900-2030 in the product name.
 * Returns both the extracted vintage and the cleaned product name.
 *
 * @example
 *   extractVintageFromName('Opus One 2018')
 *   // returns { vintage: '2018', cleanedName: 'Opus One' }
 *
 *   extractVintageFromName('2019 Screaming Eagle Cabernet')
 *   // returns { vintage: '2019', cleanedName: 'Screaming Eagle Cabernet' }
 *
 *   extractVintageFromName('Champagne NV')
 *   // returns { vintage: null, cleanedName: 'Champagne NV' }
 *
 * @param productName - The full product name potentially containing vintage
 * @returns Object with extracted vintage and cleaned name
 */
const extractVintageFromName = (productName: string) => {
  if (!productName) {
    return { vintage: null, cleanedName: productName };
  }

  // Match 4-digit years between 1900-2030
  // Common patterns:
  // - "Wine Name 2018" (most common)
  // - "2018 Wine Name" (less common)
  // - "Wine Name (2018)" (parenthetical)
  // - "Wine Name, 2018" (comma separated)
  const vintageRegex = /\b(19[0-9]{2}|20[0-3][0-9])\b/g;

  const matches = productName.match(vintageRegex);

  if (!matches || matches.length === 0) {
    return { vintage: null, cleanedName: productName.trim() };
  }

  // Take the last match (usually the vintage is at the end)
  // But if there's a match at the start, prefer that for "2018 Wine Name" pattern
  let vintage: string;
  const firstMatch = matches[0];
  const lastMatch = matches[matches.length - 1];

  // Check if the first match is at the very beginning of the string
  if (productName.trim().startsWith(firstMatch!)) {
    vintage = firstMatch!;
  } else {
    // Otherwise take the last match (more likely to be the vintage)
    vintage = lastMatch!;
  }

  // Clean the product name by removing the vintage
  // Handle various patterns: "Name 2018", "2018 Name", "Name, 2018", "Name (2018)"
  let cleanedName = productName
    // Remove vintage with surrounding parentheses
    .replace(new RegExp(`\\(\\s*${vintage}\\s*\\)`, 'g'), '')
    // Remove vintage with preceding comma
    .replace(new RegExp(`,\\s*${vintage}`, 'g'), '')
    // Remove vintage with following comma (less common)
    .replace(new RegExp(`${vintage}\\s*,`, 'g'), '')
    // Remove standalone vintage
    .replace(new RegExp(`\\b${vintage}\\b`, 'g'), '')
    // Clean up extra whitespace
    .replace(/\s+/g, ' ')
    .trim();

  // Remove trailing/leading punctuation that might be left over
  cleanedName = cleanedName.replace(/^[,.\-–—]\s*/, '').replace(/\s*[,.\-–—]$/, '');

  return {
    vintage,
    cleanedName: cleanedName || productName.trim(),
  };
};

export default extractVintageFromName;
