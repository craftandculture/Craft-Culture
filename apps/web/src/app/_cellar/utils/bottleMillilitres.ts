/**
 * A stock row's bottle size in millilitres
 *
 * Stock records its size the way it was received — '75cl' from receiving,
 * '750ml' from imports, '1.5L' from the odd supplier sheet. Reading '150cl' as
 * 150 millilitres made a magnum count as a fifth of a bottle, so the unit is
 * read, not assumed. A bare number of 100 or more is millilitres; below that it
 * is centilitres. Anything unreadable is a standard 75cl bottle.
 *
 * @example
 *   bottleMillilitres('150cl'); // 1500
 *   bottleMillilitres('1.5L'); // 1500
 *   bottleMillilitres('750ml'); // 750
 *
 * @param size - The stock row's bottle size
 * @returns Millilitres
 */
const bottleMillilitres = (size: string | null | undefined) => {
  const match = (size ?? '').trim().toLowerCase().match(/^(\d+(?:[.,]\d+)?)\s*(ml|cl|l)?/);

  if (!match?.[1]) return 750;

  const value = Number.parseFloat(match[1].replace(',', '.'));

  if (!Number.isFinite(value) || value <= 0) return 750;

  const unit = match[2] ?? (value >= 100 ? 'ml' : 'cl');

  if (unit === 'l') return Math.round(value * 1000);
  if (unit === 'cl') return Math.round(value * 10);

  return Math.round(value);
};

export default bottleMillilitres;
