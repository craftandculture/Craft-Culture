/**
 * A bottle size as people say it: 75cl, 150cl, 20cl
 *
 * Stored sizes arrive as "75cl", "750ml", "750" or nothing at all; a blank is
 * a standard bottle.
 */
const toCl = (bottleSize: string | null | undefined) => {
  const raw = String(bottleSize ?? '').trim().toLowerCase();
  if (!raw) return '75cl';
  if (raw.endsWith('cl')) return raw.replace(/\s+/g, '');
  const ml = Number(raw.replace(/[^0-9.]/g, ''));
  if (!ml) return raw;
  return `${Math.round(ml / 10)}cl`;
};

/**
 * How one order line reads to a person: what it is, how many, and per what
 *
 * A line's quantity counts the units it is sold in, and a unit is either a
 * case or a single bottle (a "case of 1"). Showing both as "cases" is what
 * made orders hard to read — six single bottles appeared as "6 cases", and a
 * price per case of one bottle as "/case". Singles are named as bottles, and
 * cases say how many bottles they hold.
 *
 * @example
 *   describePcoLine({ quantity: 2, caseConfig: 6, bottleSize: '75cl' });
 *   // { pack: 'Case of 6 × 75cl', qty: '2 cases · 12 btl', unit: 'case', ... }
 *   describePcoLine({ quantity: 1, caseConfig: 1, bottleSize: null });
 *   // { pack: 'Bottle · 75cl', qty: '1 bottle', unit: 'btl', ... }
 *
 * @param line - The line's quantity, bottles per case and bottle size
 * @returns Labels for pack, quantity and price unit, and the bottle count
 */
const describePcoLine = ({
  quantity,
  caseConfig,
  bottleSize,
}: {
  quantity: number;
  caseConfig?: number | null;
  bottleSize?: string | null;
}) => {
  const perCase = caseConfig && caseConfig > 0 ? caseConfig : 1;
  const size = toCl(bottleSize);
  const bottles = quantity * perCase;
  const isSingle = perCase === 1;

  return {
    isSingle,
    bottles,
    unit: isSingle ? ('btl' as const) : ('case' as const),
    pack: isSingle ? `Bottle · ${size}` : `Case of ${perCase} × ${size}`,
    qty: isSingle
      ? `${quantity} ${quantity === 1 ? 'bottle' : 'bottles'}`
      : `${quantity} ${quantity === 1 ? 'case' : 'cases'} · ${bottles} btl`,
  };
};

export default describePcoLine;
