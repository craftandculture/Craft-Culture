import { z } from 'zod';

import askWinelabsForLine from '@/app/_logistics/data/askWinelabsForLine';
import { teamProcedure } from '@/lib/trpc/procedures';
import getInBondMarket from '@/lib/winelabs/getInBondMarket';
import getPriceStats from '@/lib/winelabs/getPriceStats';

/** Lines a call takes; each is three Wine Labs questions, asked together */
const MAX_LINES = 4;

const lineSchema = z.object({
  /** Producer, appellation and cuvée as the sheet wrote them */
  name: z.string().min(3).max(300),
  producer: z.string().max(200).nullable(),
  vintage: z.number().int().min(1800).max(2100).nullable(),
  /** Bottle size in ml: 750, 1500 */
  sizeMl: z.number().int().positive().default(750),
});

/**
 * Price wines from a client's or supplier's list against Wine Labs
 *
 * For a sheet that is not our stock (a collector's cellar offered to us): the
 * name search finds each wine's LWIN, then its worldwide retail median and
 * its London in-bond market (best bid, best ask, last trade) are asked for.
 * About 33 credits a wine; nothing is saved, and Wine Labs' match comes back
 * with its fit so a person can see which lines to check by hand.
 *
 * C&C staff only while the Wine Labs licence is open.
 */
const priceSheetLines = teamProcedure
  .input(z.object({ lines: z.array(lineSchema).min(1).max(MAX_LINES) }))
  .mutation(async ({ input }) =>
    Promise.all(
      input.lines.map(async (line) => {
        try {
          const withProducer =
            line.producer && !line.name.toLowerCase().includes(line.producer.toLowerCase())
              ? `${line.producer} ${line.name}`
              : line.name;
          const match = await askWinelabsForLine(withProducer, line.name, line.vintage);
          if (!match) return { status: 'none' as const, error: null };

          const vintage = line.vintage ? String(line.vintage) : '1000';
          const [retail, london] = await Promise.all([
            getPriceStats(`${match.lwin7}${vintage}`).catch(() => null),
            getInBondMarket(match.lwin7, vintage, true, String(line.sizeMl)).catch(() => null),
          ]);

          return {
            status: 'matched' as const,
            error: null,
            lwin7: match.lwin7,
            wine: match.name,
            fit: match.fit,
            retailMedianUsd: retail?.medianUsd ?? null,
            retailCount: retail?.count ?? null,
            london: london
              ? {
                  bidUsd: london.bidUsd,
                  askUsd: london.askUsd,
                  lastUsd: london.lastUsd,
                  lastTradedAt: london.lastTradedAt,
                  venues: london.venues,
                }
              : null,
          };
        } catch (error) {
          return { status: 'error' as const, error: error instanceof Error ? error.message : 'Wine Labs did not answer' };
        }
      }),
    ),
  );

export default priceSheetLines;
