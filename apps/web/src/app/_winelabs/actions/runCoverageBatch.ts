'use server';

import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import getCurrentUser from '@/app/_auth/data/getCurrentUser';
import isStaff from '@/app/_distribution/utils/isStaff';
import checkWine from '@/app/_winelabs/data/checkWine';
import getStockWines from '@/app/_winelabs/data/getStockWines';
import db from '@/database/client';
import { winelabsWines } from '@/database/schema';

export interface CoverageBatchResult {
  checked: number;
  remaining: number;
  error: string | null;
}

/**
 * Check the next batch of unchecked wines against Wine Labs
 *
 * Largest holdings first, one wine at a time, stopping at the first error so
 * a wrong key or a reached cap costs nothing further and is shown, not
 * swallowed. Wines already checked are skipped, so each press moves on.
 *
 * @param _previous - The last result, unused (useActionState)
 * @param formData - `size`: wines to check, 1 to 25
 * @returns How many were checked, how many remain, and any error
 */
const runCoverageBatch = async (
  _previous: CoverageBatchResult | null,
  formData: FormData,
): Promise<CoverageBatchResult> => {
  const user = await getCurrentUser();
  if (!isStaff(user)) {
    return { checked: 0, remaining: 0, error: 'C&C staff only.' };
  }

  const size = Math.min(25, Math.max(1, Math.round(Number(formData.get('size')) || 1)));

  /*
    A claim left at 'checking' for longer than any check can take belongs to a
    run that died (a timeout kills the function before its catch runs). It
    used to block that wine forever; it is now cleared and the wine retried.
  */
  await db
    .delete(winelabsWines)
    .where(
      and(
        eq(winelabsWines.matchStatus, 'checking'),
        sql`${winelabsWines.matchedAt} < NOW() - INTERVAL '15 minutes'`,
      ),
    );

  const [wines, done] = await Promise.all([
    getStockWines(),
    db.select({ lwin11: winelabsWines.lwin11 }).from(winelabsWines),
  ]);
  const checkedAlready = new Set(done.map((row) => row.lwin11));
  const todo = wines.filter((wine) => !checkedAlready.has(wine.lwin11));

  let checked = 0;
  let error: string | null = null;
  for (const wine of todo) {
    if (checked >= size) break;

    // Claim the wine first, so a second run started alongside this one skips it rather than paying twice
    const [claimed] = await db
      .insert(winelabsWines)
      .values({ lwin11: wine.lwin11, ourLwin7: wine.lwin7, ourName: wine.name, matchStatus: 'checking' })
      .onConflictDoNothing()
      .returning({ lwin11: winelabsWines.lwin11 });
    if (!claimed) continue;

    try {
      await checkWine(wine);
      checked += 1;
    } catch (caught) {
      await db
        .delete(winelabsWines)
        .where(and(eq(winelabsWines.lwin11, wine.lwin11), eq(winelabsWines.matchStatus, 'checking')));
      error = `${wine.name} ${wine.vintage}: ${caught instanceof Error ? caught.message : String(caught)}`;
      console.error('Wine Labs check failed', { lwin11: wine.lwin11, caught });
      break;
    }
  }

  revalidatePath('/platform/admin/wine-labs');
  return { checked, remaining: todo.length - checked, error };
};

export default runCoverageBatch;
