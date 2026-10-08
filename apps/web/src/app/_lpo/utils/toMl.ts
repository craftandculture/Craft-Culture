/**
 * A bottle size in millilitres, however a row happens to spell it.
 *
 * @example
 *   toMl('75cl'); // 750
 *   toMl('1.5L'); // 1500
 *   toMl('300cl'); // 3000
 *
 * @param size - "75cl", "750ml", "1.5L", or anything without a unit
 * @returns Millilitres, or null when no size with a unit can be read
 */
const toMl = (size: string | number | null | undefined) => {
  const match = String(size ?? '').match(/([\d.]+)\s*(cl|ml|l)\b/i);
  if (!match?.[1] || !match[2]) return null;

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();

  return unit === 'ml' ? value : unit === 'cl' ? value * 10 : value * 1000;
};

export default toMl;
