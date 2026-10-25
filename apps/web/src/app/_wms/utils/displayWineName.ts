/**
 * A catalogue name with the facts that have their own columns trimmed off
 *
 * Stock names carry vintage, bottle size and strength — "Dom Pérignon P2 2006
 * 0.75L 12.5%abv" — because the catalogue has to identify a wine in one string.
 * A table that already has Vintage and Format columns then prints each fact
 * twice and the name is too long to read.
 *
 * Each pattern is anchored to the end — a pack note such as "(1x)" or
 * "(1x75cl)", then strength (with or without "abv"), then size, then vintage —
 * and the set is applied until nothing more comes off, since names stack them.
 *
 * Trimming the vintage is only safe where a column shows it. Somewhere with no
 * such column — a dialog heading, a notification — three vintages of one wine
 * would read as the same line, so compose the detail back on rather than
 * reaching for the raw name.
 *
 * @example
 *   displayWineName('Dom Pérignon P2 2006 0.75L 12.5%abv'); // 'Dom Pérignon P2'
 *
 * @param name - The stored product name
 * @returns The name alone
 */
const TRAILING_FACTS = [
  // Pack notes: "(1x)", "(3x)", "(1x75cl)", "(6 x 75cl)"
  /\s*\(\s*\d+\s*x\s*(\d+(\.\d+)?\s*(cl|ml|l))?\s*\)\s*$/i,
  /\s+\d+(\.\d+)?%\s*(abv)?\s*$/i,
  /\s+\d+(\.\d+)?\s*(L|cl|ml)\s*$/i,
  /\s+(19|20)\d{2}\s*$/,
];

/* Repeated until nothing more comes off: names stack them, "2023 0.75L 13.5%abv (1x75cl)" */
const displayWineName = (name: string) => {
  let current = name.trim();
  for (;;) {
    const next = TRAILING_FACTS.reduce((text, pattern) => text.replace(pattern, ''), current).trim();
    if (next === current) return current;
    current = next;
  }
};

export default displayWineName;
