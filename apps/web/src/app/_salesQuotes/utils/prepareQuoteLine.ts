import type { SalesQuoteLine } from '@/database/schema';

import { AED_PER_USD } from '../constants';
import type { PreparedLine } from '../types';
import sizeDisplay from './sizeDisplay';
import wineBaseKey from './wineBaseKey';

const round = (value: number | null | undefined) =>
  value == null ? 0 : Math.round(value);

/**
 * Resolve a stored quote line into every value the row markup needs.
 *
 * Mirrors `build_item` in the Python builder:
 * - AED derives at {@link AED_PER_USD} unless the line carries its own `baed`,
 *   which is used verbatim so a quote can match the price list to the cent
 * - a line is a REPACK when its quantity is not a whole multiple of the pack,
 *   because a part-case has to be drawn from a sealed case
 *
 * @param line - The stored line
 * @param orderUnit - Whether the quote is ordered per bottle or per case
 * @returns The prepared line
 */
const prepareQuoteLine = (
  line: SalesQuoteLine,
  orderUnit: string,
): PreparedLine => {
  const pack = Math.max(1, Number(line.pack) || 1);
  const size = Number(line.size) || 75;
  const avail = Math.max(0, Number(line.avail) || 0);
  const bottleUsd = Number(line.busd) || 0;
  const bottleAed =
    line.baed != null ? Number(line.baed) : bottleUsd * AED_PER_USD;
  const caseUsd = line.cusd != null ? Number(line.cusd) : bottleUsd * pack;
  const caseAed = line.caed != null ? Number(line.caed) : bottleAed * pack;

  const bottleMode = orderUnit === 'bottle';
  const single = pack <= 1;
  const maxUnits = bottleMode ? avail : Math.floor(avail / pack) || avail;
  const qty = maxUnits ? Math.min(Number(line.qty) || 0, maxUnits) : 0;

  return {
    wine: line.wine,
    vintage: String(line.vintage),
    region: line.region || 'Other',
    size: sizeDisplay(size),
    sizeCl: size,
    mag: size >= 150,
    oos: !!line.oos,
    promo: !!line.promo,
    pc: !!line.pc,
    repack: !!(qty && pack > 1 && qty % pack !== 0),
    loc: line.loc || '',
    note: line.note || '',
    pack,
    single,
    avail,
    qty,
    maxUnits,
    unit: bottleMode || single ? 'bottle' : 'case',
    bottleMode,
    low: maxUnits > 0 && maxUnits <= 1 && !line.oos,
    bottleAed: round(bottleAed),
    bottleUsd: round(bottleUsd),
    caseAed: round(caseAed),
    caseUsd: round(caseUsd),
    baseKey: wineBaseKey(line.wine),
    vintageYear: Number(line.vintage) || 0,
  };
};

export default prepareQuoteLine;
