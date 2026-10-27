import { del } from '@vercel/blob';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { deleteStoredFile, putPrivateFile } from '@/lib/blob/privateFiles';
import { staffAdminProcedure } from '@/lib/trpc/procedures';
import isVercelBlobUrl from '@/utils/isVercelBlobUrl';
import logger from '@/utils/logger';

/** Files still at a public address */
const PUBLIC = '%.public.blob.vercel-storage.com/%';

/** Files moved per call, so one call stays well inside a request's time limit */
const BATCH = 20;

/**
 * Every column that holds the address of a private document
 *
 * One file can sit in several places (an export invoice's PDF is on the
 * invoice, its version and the shipment's documents), so a file is copied
 * once and every reference to it is repointed together. Members' identity
 * documents are not here: they are encrypted and served by their own route.
 */
const REFERENCES = [
  ['quotes', 'payment_proof_url'],
  ['quotes', 'po_attachment_url'],
  ['private_client_order_documents', 'file_url'],
  ['private_client_orders', 'delivery_photo'],
  ['private_client_orders', 'partner_payment_proof_url'],
  ['logistics_documents', 'file_url'],
  ['logistics_group_documents', 'file_url'],
  ['logistics_quote_attachments', 'file_url'],
  ['logistics_quote_request_attachments', 'file_url'],
  ['export_invoices', 'pdf_url'],
  ['export_invoice_versions', 'pdf_url'],
  ['wms_delivery_notes', 'pdf_url'],
  ['team_task_attachments', 'file_url'],
  ['source_purchase_orders', 'pdf_url'],
  ['source_supplier_orders', 'excel_file_url'],
  ['source_supplier_orders', 'pdf_file_url'],
] as const;

type Outcome = 'moved' | 'missing' | 'failed';

/** Distinct public addresses still referenced anywhere, plus stock photos */
const publicUrls = async (limit: number, skip: string[]) => {
  const unions = REFERENCES.map(
    ([table, column]) =>
      `SELECT "${column}" AS url FROM "${table}" WHERE "${column}" LIKE '${PUBLIC}'`,
  );
  unions.push(
    `SELECT jsonb_array_elements_text("photos") AS url FROM "wms_stock" WHERE "photos"::text LIKE '${PUBLIC}'`,
  );

  const rows = await db.execute<{ url: string }>(
    sql.raw(`SELECT DISTINCT url FROM (${unions.join(' UNION ALL ')}) refs WHERE url LIKE '${PUBLIC}'`),
  );

  const all = [...rows].map((row) => row.url).filter((url) => !skip.includes(url));

  return { batch: all.slice(0, limit), remaining: all.length };
};

/** Point every reference to one file at its new address */
const repointAll = async (oldUrl: string, newUrl: string) => {
  await db.transaction(async (tx) => {
    for (const [table, column] of REFERENCES) {
      await tx.execute(
        sql`UPDATE ${sql.identifier(table)} SET ${sql.identifier(column)} = ${newUrl} WHERE ${sql.identifier(column)} = ${oldUrl}`,
      );
    }
    await tx.execute(
      sql`UPDATE "wms_stock" SET "photos" = (
            SELECT jsonb_agg(CASE WHEN p = ${oldUrl} THEN ${newUrl} ELSE p END)
            FROM jsonb_array_elements_text("photos") p
          )
          WHERE "photos" ? ${oldUrl}`,
    );
  });
};

/**
 * Copy one file to the private store, repoint every record that holds it,
 * then delete the public original
 *
 * The original is deleted last, so a failure part-way never leaves a record
 * without a file.
 */
const moveOne = async (oldUrl: string): Promise<Outcome> => {
  if (!isVercelBlobUrl(oldUrl)) return 'failed';

  const response = await fetch(oldUrl);
  if (response.status === 404) return 'missing';
  if (!response.ok) return 'failed';

  const body = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
  const pathname = decodeURIComponent(new URL(oldUrl).pathname.slice(1));

  const { url: newUrl } = await putPrivateFile(pathname, body, contentType);

  try {
    await repointAll(oldUrl, newUrl);
  } catch (error) {
    await deleteStoredFile(newUrl).catch(() => undefined);
    throw error;
  }

  try {
    await del(oldUrl);
  } catch (error) {
    // The records already point at the private copy; the stray original is logged
    logger.error('[files] public original not deleted', { oldUrl, error });
  }

  return 'moved';
};

/**
 * Move every private document still at a public address to the private store
 *
 * Payment proofs, purchase orders, order documents and delivery photos,
 * shipment and customs papers, freight quote attachments, export invoices,
 * delivery notes, receiving photos and Team Task files. Run repeatedly until
 * `remaining` is zero, passing back the URLs reported missing or failed as
 * `skip` so they are not retried. Staff only.
 */
const adminMoveFilesToPrivate = staffAdminProcedure
  .input(
    z.object({
      dryRun: z.boolean().default(true),
      /** Files reported missing or failed on an earlier call, not retried */
      skip: z.array(z.string()).max(1000).default([]),
    }),
  )
  .mutation(async ({ input }) => {
    const { batch, remaining } = await publicUrls(input.dryRun ? 0 : BATCH, input.skip);

    if (input.dryRun) {
      return { moved: 0, missing: [], failed: [], remaining };
    }

    const results: { url: string; outcome: Outcome }[] = [];

    for (const url of batch) {
      const outcome = await moveOne(url).catch((error: unknown) => {
        logger.error('[files] move failed', { url, error });
        return 'failed' as const;
      });
      results.push({ url, outcome });
    }

    const summary = {
      moved: results.filter((r) => r.outcome === 'moved').length,
      missing: results.filter((r) => r.outcome === 'missing').map((r) => r.url),
      failed: results.filter((r) => r.outcome === 'failed').map((r) => r.url),
      remaining: remaining - results.filter((r) => r.outcome === 'moved').length,
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
