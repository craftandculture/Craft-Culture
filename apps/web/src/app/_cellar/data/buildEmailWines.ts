import { inArray } from 'drizzle-orm';

import db from '@/database/client';
import { lwinWines } from '@/database/schema';

import collectorWineName from '../utils/collectorWineName';

export interface EmailWineLine {
  name: string;
  vintage?: string | number | null;
  lwin18?: string | null;
  /** As a collector says it: "6 bottles", "2 cases of 6", "3 magnums" */
  quantity: string;
}

export interface EmailWine {
  name: string;
  detail: string;
  quantity: string;
}

/**
 * The wines for a member email: the collector's name for each wine with its
 * vintage, and where it comes from underneath
 *
 * Region is not stored on any cellar line, so it comes from the LWIN
 * database by the wine's seven-digit code; a wine without one shows its
 * name alone. Never throws: a failed lookup leaves the region off.
 *
 * @param lines - The wines in the order the email lists them
 * @returns Name, region line and quantity for each
 */
const buildEmailWines = async (lines: EmailWineLine[]): Promise<EmailWine[]> => {
  const codes = [
    ...new Set(
      lines.map((line) => (line.lwin18 ?? '').slice(0, 7)).filter((code) => /^\d{7}$/.test(code)),
    ),
  ];

  let regionByLwin = new Map<string, string>();
  if (codes.length) {
    try {
      const rows = await db
        .select({
          lwin: lwinWines.lwin,
          region: lwinWines.region,
          subRegion: lwinWines.subRegion,
          country: lwinWines.country,
        })
        .from(lwinWines)
        .where(inArray(lwinWines.lwin, codes));

      regionByLwin = new Map(
        rows.map((row) => [
          row.lwin,
          // "Pauillac, Bordeaux", or the country where the region is the country
          [row.subRegion, row.region ?? row.country].filter(Boolean).join(', '),
        ]),
      );
    } catch {
      // The email still reads well without the region
    }
  }

  return lines.map((line) => {
    const name = collectorWineName(line.name);
    const vintage = line.vintage ? String(line.vintage) : '';
    const withVintage = vintage && !name.includes(vintage) ? `${name} ${vintage}` : name;

    return {
      name: withVintage,
      detail: regionByLwin.get((line.lwin18 ?? '').slice(0, 7)) ?? '',
      quantity: line.quantity,
    };
  });
};

export default buildEmailWines;
