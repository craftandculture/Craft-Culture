import bottleMillilitres from './bottleMillilitres';

/**
 * A bottle size as a collector would say it
 *
 * The trade writes "6×150cl"; a private client thinks "magnum". Standard and
 * half bottles keep their size, the classic large formats get their name, and
 * anything else is shown in litres or centilitres.
 *
 * @example
 *   bottleName('150cl'); // 'Magnum'
 *   bottleName('75cl'); // '75cl'
 *
 * @param size - The bottle size as stored
 * @returns A readable name
 */
const bottleName = (size: string | null | undefined) => {
  const ml = bottleMillilitres(size);
  const names: Record<number, string> = {
    375: 'Half bottle',
    1500: 'Magnum',
    3000: 'Double magnum',
    4500: 'Rehoboam',
    5000: 'Jeroboam',
    6000: 'Imperial',
  };

  return names[ml] ?? (ml >= 1000 ? `${ml / 1000}L` : `${ml / 10}cl`);
};

export default bottleName;
