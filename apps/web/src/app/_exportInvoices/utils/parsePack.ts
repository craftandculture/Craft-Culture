/**
 * Convert a size and its unit to centilitres
 *
 * @param value - The number as written
 * @param unit - cl, ml or l
 * @returns The size in cl
 */
const toCl = (value: number, unit: string) => {
  const u = unit.toLowerCase();
  if (u === 'ml') return Math.round(value / 10);
  if (u === 'l') return Math.round(value * 100);
  return Math.round(value);
};

/**
 * Read the pack an invoice line sells
 *
 * Zoho writes it every way at once: "6x75cl" in the description, "(3x)" or
 * "(6pk)" in the name, "06x75cl" with a stray zero, "3 x 75cl" with spaces,
 * "0.75L" on its own. The explicit `NxSIZE` form wins; a bare count in
 * brackets is next; a size alone means a single bottle. Returns null when the
 * line says nothing usable, so the operator is asked rather than guessed for.
 *
 * @example
 *   parsePack('6x75cl'); // { packBottles: 6, bottleSizeCl: 75 }
 *   parsePack('Sassicaia 2016 (3x)'); // { packBottles: 3, bottleSizeCl: 75 }
 *   parsePack('1x600cl'); // { packBottles: 1, bottleSizeCl: 600 }
 *
 * @param text - Description and name of the line, joined
 * @returns The pack, or null when it cannot be read
 */
const parsePack = (text: string) => {
  const explicit = text.match(/(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*(cl|ml|l)\b/i);
  if (explicit) {
    const packBottles = parseInt(explicit[1] ?? '0', 10);
    const bottleSizeCl = toCl(Number(explicit[2]), explicit[3] ?? 'cl');
    if (packBottles > 0 && bottleSizeCl > 0) return { packBottles, bottleSizeCl };
  }

  const size = text.match(/(\d+(?:\.\d+)?)\s*(cl|ml|l)\b/i);
  const bottleSizeCl = size ? toCl(Number(size[1]), size[2] ?? 'cl') : null;

  const count = text.match(/\(\s*(\d+)\s*(?:x|pk|pack|\s*pk)\s*\)/i);
  if (count) {
    const packBottles = parseInt(count[1] ?? '0', 10);
    if (packBottles > 0) return { packBottles, bottleSizeCl: bottleSizeCl ?? 75 };
  }

  if (bottleSizeCl) return { packBottles: 1, bottleSizeCl };
  return null;
};

export default parsePack;
