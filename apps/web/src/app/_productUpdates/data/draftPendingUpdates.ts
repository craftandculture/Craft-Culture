import db from '@/database/client';
import { productUpdates } from '@/database/schema';
import logger from '@/utils/logger';

import getPendingReleaseNotes from './getPendingReleaseNotes';
import type { ReleaseNote } from '../types';
import draftMemberUpdates from '../utils/draftMemberUpdates';

const BATCH_SIZE = 10;
const PARALLEL = 3;

/**
 * Read the changelog items not yet read, and save what the AI made of them
 *
 * Member-facing items become drafts; the rest are saved as skipped with the
 * AI's reason, so staff can see and overrule each decision. Nothing is ever
 * published here. Bounded per run so a long backlog finishes over several
 * runs rather than timing out; an item the AI did not answer stays pending.
 *
 * @param maxItems - The most items to read in this run
 * @returns How many were drafted and skipped, and how many still wait
 */
const draftPendingUpdates = async ({ maxItems = 60 }: { maxItems?: number } = {}) => {
  const pending = await getPendingReleaseNotes();
  const toRead = pending.slice(0, maxItems);

  const batches: ReleaseNote[][] = [];
  for (let i = 0; i < toRead.length; i += BATCH_SIZE) {
    batches.push(toRead.slice(i, i + BATCH_SIZE));
  }

  let drafted = 0;
  let skipped = 0;
  let failedBatches = 0;

  for (let i = 0; i < batches.length; i += PARALLEL) {
    const results = await Promise.allSettled(
      batches.slice(i, i + PARALLEL).map(async (batch) => {
        const answers = await draftMemberUpdates(batch);
        const byHash = new Map(batch.map((note) => [note.hash, note]));

        const rows = answers.flatMap((answer) => {
          const note = byHash.get(answer.hash);
          if (!note) return [];

          const sourceText = [note.text, ...note.notes.map((n) => `- ${n}`)].join('\n');
          const isForMembers = answer.memberFacing && answer.audiences.length > 0;

          return [
            {
              type: answer.type,
              audiences: isForMembers ? answer.audiences : [],
              title: isForMembers ? answer.title : note.text,
              body: isForMembers ? answer.body : '',
              linkPath: isForMembers ? answer.linkPath : null,
              status: isForMembers ? ('draft' as const) : ('skipped' as const),
              releaseVersion: note.version,
              sourceRef: note.hash,
              sourceText,
              skippedReason: isForMembers ? null : (answer.skippedReason ?? 'Not visible to members'),
              /* Dated by the release, so the timeline follows when it shipped */
              createdAt: new Date(`${note.date}T12:00:00Z`),
            },
          ];
        });

        if (rows.length > 0) {
          await db.insert(productUpdates).values(rows).onConflictDoNothing({ target: productUpdates.sourceRef });
        }

        return rows;
      }),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        drafted += result.value.filter((row) => row.status === 'draft').length;
        skipped += result.value.filter((row) => row.status === 'skipped').length;
      } else {
        failedBatches += 1;
        logger.error('What’s New: drafting a batch failed', {
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    }
  }

  return {
    drafted,
    skipped,
    failedBatches,
    remaining: pending.length - drafted - skipped,
  };
};

export default draftPendingUpdates;
