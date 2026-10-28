import { inArray } from 'drizzle-orm';

import getStockWines from '@/app/_winelabs/data/getStockWines';
import judgeLwinMatch from '@/app/_winelabs/utils/judgeLwinMatch';
import db from '@/database/client';
import { lwinWines, winelabsWines } from '@/database/schema';

/**
 * The LWINs we hold that Wine Labs' name search disagrees with, judged
 *
 * Each code, ours and Wine Labs', is looked up in our copy of the LWIN register
 * (free), and our product name is read against both: the one it reads as is
 * probably right. Internal codes Wine Labs could name are listed too, as wines
 * that could move onto a real LWIN. Wines no longer in stock drop out. Nothing
 * is recoded here; a person's call is recorded.
 *
 * @returns The wines to review, likely-wrong first, largest holdings first
 */
const getLwinReview = async () => {
  const [stock, rows] = await Promise.all([
    getStockWines(),
    db
      .select()
      .from(winelabsWines)
      .where(
        inArray(winelabsWines.matchStatus, ['different', 'internal_known']),
      ),
  ]);
  const held = new Map(stock.map((wine) => [wine.lwin11, wine]));
  const inStock = rows.filter((row) => held.has(row.lwin11));

  const codes = [
    ...new Set(
      inStock
        .flatMap((row) => [row.ourLwin7, row.wlLwin7 ?? ''])
        .filter(Boolean),
    ),
  ];
  const register = codes.length
    ? await db
        .select({ lwin: lwinWines.lwin, displayName: lwinWines.displayName })
        .from(lwinWines)
        .where(inArray(lwinWines.lwin, codes))
    : [];
  const nameOf = new Map(register.map((wine) => [wine.lwin, wine.displayName]));

  const ORDER = {
    likely_wrong: 0,
    check: 1,
    ours_right: 2,
    same_wine: 3,
  } as const;

  return inStock
    .map((row) => {
      const wine = held.get(row.lwin11)!;
      const ourRegisterName = nameOf.get(row.ourLwin7) ?? null;
      const suggestedRegisterName = row.wlLwin7
        ? (nameOf.get(row.wlLwin7) ?? row.wlDisplayName)
        : null;
      return {
        lwin11: row.lwin11,
        name: row.ourName,
        vintage: wine.vintage,
        bottles: wine.bottles,
        internal: row.matchStatus === 'internal_known',
        ourLwin7: row.ourLwin7,
        ourRegisterName,
        suggestedLwin7: row.wlLwin7,
        suggestedRegisterName,
        verdict:
          row.matchStatus === 'internal_known'
            ? ('likely_wrong' as const)
            : judgeLwinMatch(
                row.ourName,
                ourRegisterName,
                suggestedRegisterName,
              ),
        review: row.review,
        reviewedBy: row.reviewedBy,
        reviewedAt: row.reviewedAt,
      };
    })
    .sort(
      (a, b) => ORDER[a.verdict] - ORDER[b.verdict] || b.bottles - a.bottles,
    );
};

export type LwinReviewRow = Awaited<ReturnType<typeof getLwinReview>>[number];

export default getLwinReview;
