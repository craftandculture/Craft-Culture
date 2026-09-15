/**
 * A catalogue name with the facts that have their own columns trimmed off
 *
 * Stock names carry vintage, bottle size and strength — "Dom Pérignon P2 2006
 * 0.75L 12.5%abv" — because the catalogue has to identify a wine in one string.
 * A table that already has Vintage and Format columns then prints each fact
 * twice and the name is too long to read.
 *
 * The order matters: each pattern is anchored to the end, so strength comes off
 * before size, and size before vintage. Run out of order they stop matching.
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
const displayWineName = (name: string) =>
  name
    .replace(/\s+\d+(\.\d+)?%\s*abv\s*$/i, '')
    .replace(/\s+\d+(\.\d+)?L\s*$/i, '')
    .replace(/\s+(19|20)\d{2}\s*$/, '')
    .trim();

export default displayWineName;
