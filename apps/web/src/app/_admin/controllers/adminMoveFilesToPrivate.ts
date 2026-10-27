import { del } from '@vercel/blob';
import { and, count, eq, like, notInArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrderDocuments, quotes } from '@/database/schema';
import { deleteStoredFile, putPrivateFile } from '@/lib/blob/privateFiles';
import { staffAdminProcedure } from '@/lib/trpc/procedures';
import isVercelBlobUrl from '@/utils/isVercelBlobUrl';
import logger from '@/utils/logger';

/** Files still at a public address */
const PUBLIC = '%.public.blob.vercel-storage.com/%';

/** Files moved per call, so one call stays well inside a request's time limit */
const BATCH = 20;

type Outcome = 'moved' | 'missing' | 'failed' | 'changed';

/**
 * Copy one file to the private store, point its record at the copy, then delete
 * the public original
 *
 * The record is only repointed if it still holds the old address; if someone
 * replaced the file meanwhile the copy is discarded. The public original is
 * deleted last, so a failure part-way never leaves a record without a file.
 */
const moveOne = async (
  oldUrl: string,
  repoint: (newUrl: string) => Promise<boolean>,
): Promise<Outcome> => {
  if (!isVercelBlobUrl(oldUrl)) return 'failed';

  const response = await fetch(oldUrl);
  if (response.status === 404) return 'missing';
  if (!response.ok) return 'failed';

  const body = Buffer.from(await response.arrayBuffer());
  const contentType =
    response.headers.get('content-type') ?? 'application/octet-stream';
  const pathname = decodeURIComponent(new URL(oldUrl).pathname.slice(1));

  const { url: newUrl } = await putPrivateFile(pathname, body, contentType);

  if (!(await repoint(newUrl))) {
    await deleteStoredFile(newUrl);
    return 'changed';
  }

  try {
    await del(oldUrl);
  } catch (error) {
    // The record already points at the private copy; the stray original is logged
    logger.error('[files] public original not deleted', { oldUrl, error });
  }

  return 'moved';
};

/**
 * Move payment proofs, customer POs and private-order documents to the private
 * store
 *
 * Run repeatedly until `remaining` is zero, passing back the URLs reported
 * missing or failed as `skip` so they are not retried. Staff only. Each call
 * moves up to a batch of files and reports what is left, so it can be stopped
 * and resumed.
 */
const adminMoveFilesToPrivate = staffAdminProcedure
  .input(
    z.object({
      dryRun: z.boolean().default(true),
      /** Files reported missing or failed on an earlier call, not retried */
      skip: z.array(z.string()).max(500).default([]),
    }),
  )
  .mutation(async ({ input }) => {
    const remaining = async () => {
      const [[proofs], [pos], [documents]] = await Promise.all([
        db
          .select({ n: count() })
          .from(quotes)
          .where(like(quotes.paymentProofUrl, PUBLIC)),
        db
          .select({ n: count() })
          .from(quotes)
          .where(like(quotes.poAttachmentUrl, PUBLIC)),
        db
          .select({ n: count() })
          .from(privateClientOrderDocuments)
          .where(like(privateClientOrderDocuments.fileUrl, PUBLIC)),
      ]);

      return {
        paymentProofs: proofs?.n ?? 0,
        purchaseOrders: pos?.n ?? 0,
        orderDocuments: documents?.n ?? 0,
      };
    };

    if (input.dryRun) {
      return {
        moved: 0,
        missing: [],
        failed: [],
        remaining: await remaining(),
      };
    }

    const results: { url: string; outcome: Outcome }[] = [];

    const proofRows = await db
      .select({ id: quotes.id, url: quotes.paymentProofUrl })
      .from(quotes)
      .where(
        and(
          like(quotes.paymentProofUrl, PUBLIC),
          input.skip.length
            ? notInArray(quotes.paymentProofUrl, input.skip)
            : undefined,
        ),
      )
      .limit(BATCH);

    for (const row of proofRows) {
      if (!row.url) continue;
      const oldUrl = row.url;
      const outcome = await moveOne(oldUrl, async (newUrl) => {
        const updated = await db
          .update(quotes)
          .set({ paymentProofUrl: newUrl })
          .where(and(eq(quotes.id, row.id), eq(quotes.paymentProofUrl, oldUrl)))
          .returning({ id: quotes.id });
        return updated.length > 0;
      }).catch(() => 'failed' as const);
      results.push({ url: oldUrl, outcome });
    }

    const poRows = await db
      .select({ id: quotes.id, url: quotes.poAttachmentUrl })
      .from(quotes)
      .where(
        and(
          like(quotes.poAttachmentUrl, PUBLIC),
          input.skip.length
            ? notInArray(quotes.poAttachmentUrl, input.skip)
            : undefined,
        ),
      )
      .limit(BATCH);

    for (const row of poRows) {
      if (!row.url) continue;
      const oldUrl = row.url;
      const outcome = await moveOne(oldUrl, async (newUrl) => {
        const updated = await db
          .update(quotes)
          .set({ poAttachmentUrl: newUrl })
          .where(and(eq(quotes.id, row.id), eq(quotes.poAttachmentUrl, oldUrl)))
          .returning({ id: quotes.id });
        return updated.length > 0;
      }).catch(() => 'failed' as const);
      results.push({ url: oldUrl, outcome });
    }

    const documentRows = await db
      .select({
        id: privateClientOrderDocuments.id,
        url: privateClientOrderDocuments.fileUrl,
      })
      .from(privateClientOrderDocuments)
      .where(
        and(
          like(privateClientOrderDocuments.fileUrl, PUBLIC),
          input.skip.length
            ? notInArray(privateClientOrderDocuments.fileUrl, input.skip)
            : undefined,
        ),
      )
      .limit(BATCH);

    for (const row of documentRows) {
      const oldUrl = row.url;
      const outcome = await moveOne(oldUrl, async (newUrl) => {
        const updated = await db
          .update(privateClientOrderDocuments)
          .set({ fileUrl: newUrl })
          .where(
            and(
              eq(privateClientOrderDocuments.id, row.id),
              eq(privateClientOrderDocuments.fileUrl, oldUrl),
            ),
          )
          .returning({ id: privateClientOrderDocuments.id });
        return updated.length > 0;
      }).catch(() => 'failed' as const);
      results.push({ url: oldUrl, outcome });
    }

    const summary = {
      moved: results.filter((r) => r.outcome === 'moved').length,
      missing: results.filter((r) => r.outcome === 'missing').map((r) => r.url),
      failed: results.filter((r) => r.outcome === 'failed').map((r) => r.url),
      remaining: await remaining(),
    };

    logger.info('[files] moved to private store', {
      moved: summary.moved,
      missing: summary.missing.length,
      failed: summary.failed.length,
      remaining: summary.remaining,
    });

    return summary;
  });

export default adminMoveFilesToPrivate;
