import { inArray } from 'drizzle-orm';

import db from '@/database/client';
import { productUpdates } from '@/database/schema';
import RELEASE_NOTES from '@/generated/releaseNotes';

/**
 * Changelog items from on or after this date are read for members. Earlier
 * ones predate the Private Cellar portal members use today.
 */
export const DRAFT_FROM_DATE = '2026-10-16';

/**
 * The changelog items the AI has not read yet, oldest first
 *
 * An item is read once, whatever it decided, because its hash is stored as
 * the update's source. A newer build adds the releases since.
 */
const getPendingReleaseNotes = async () => {
  const candidates = RELEASE_NOTES.filter((note) => note.date >= DRAFT_FROM_DATE);

  if (candidates.length === 0) return [];

  const read = await db
    .select({ sourceRef: productUpdates.sourceRef })
    .from(productUpdates)
    .where(
      inArray(
        productUpdates.sourceRef,
        candidates.map((note) => note.hash),
      ),
    );

  const done = new Set(read.map((row) => row.sourceRef));

  return candidates
    .filter((note) => !done.has(note.hash))
    .sort((a, b) => a.date.localeCompare(b.date));
};

export default getPendingReleaseNotes;
