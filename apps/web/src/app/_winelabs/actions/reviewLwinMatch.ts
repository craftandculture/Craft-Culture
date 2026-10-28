'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import getCurrentUser from '@/app/_auth/data/getCurrentUser';
import isStaff from '@/app/_distribution/utils/isStaff';
import db from '@/database/client';
import { winelabsWines } from '@/database/schema';

/**
 * Record a person's call on an LWIN Wine Labs disagrees with
 *
 * Only the decision is stored. Changing the code on our stock touches Zoho,
 * labels and owner statements, so it is done deliberately, from the list of
 * wines marked "change".
 *
 * @param lwin11 - The wine and vintage
 * @param review - Ours_right, change, or null to undo
 * @returns An error message, or null
 */
const reviewLwinMatch = async (
  lwin11: string,
  review: 'ours_right' | 'change' | null,
) => {
  const user = await getCurrentUser();
  if (!isStaff(user)) return 'C&C staff only.';

  await db
    .update(winelabsWines)
    .set({
      review,
      reviewedBy: review ? (user!.name ?? user!.email) : null,
      reviewedAt: review ? new Date() : null,
    })
    .where(eq(winelabsWines.lwin11, lwin11));

  revalidatePath('/platform/admin/wine-labs');
  return null;
};

export default reviewLwinMatch;
