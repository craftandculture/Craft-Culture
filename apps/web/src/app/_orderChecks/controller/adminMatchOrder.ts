import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import type { ParsedLpo } from '@/app/_lpo/utils/parseLpoText';
import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import fetchOrderDocuments from '../data/fetchOrderDocuments';
import readLpoFile from '../data/readLpoFile';
import type { LpoReadBy } from '../data/readLpoFile';
import compareOrderDocuments, { docLabel } from '../utils/compareOrderDocuments';
import type { OrderDoc, OrderFinding } from '../utils/compareOrderDocuments';
import lpoToOrderDoc from '../utils/lpoToOrderDoc';
import orderCheckFilesReady from '../utils/orderCheckFilesReady';
import zohoToOrderDoc from '../utils/zohoToOrderDoc';

interface StoredFile {
  lpo: ParsedLpo | null;
  lpoReadBy: LpoReadBy | null;
  lpoFileName: string | null;
  attachedAt: Date | null;
  attachedBy: string | null;
  signedOffAt: Date | null;
  signedOffBy: string | null;
  signedOffStatus: string | null;
}

/** What the LPO says about itself: arithmetic the client's own form gets wrong */
const lpoSelfCheck = (lpo: ParsedLpo, doc: OrderDoc): OrderFinding[] => [
  ...lpo.lines
    .map((line, i) => ({ line, i }))
    .filter(({ line }) => line.problem)
    .map(({ line, i }) => ({
      level: 'warning' as const,
      code: 'LPO_LINE_ARITHMETIC',
      document: docLabel(doc),
      where: `Line ${i + 1} · ${line.wine}`,
      message: `The LPO's own figures do not add up: ${line.problem}`,
    })),
  ...(lpo.declaredTotalAed !== null && Math.abs(lpo.declaredTotalAed - lpo.computedTotalAed) > 0.01
    ? [
        {
          level: 'warning' as const,
          code: 'LPO_TOTAL_ARITHMETIC',
          document: docLabel(doc),
          where: 'Totals',
          message: `The LPO states AED ${lpo.declaredTotalAed.toFixed(2)} but its lines add up to AED ${lpo.computedTotalAed.toFixed(2)}`,
        },
      ]
    : []),
  ...lpo.skipped.map((text) => ({
    level: 'warning' as const,
    code: 'LPO_UNREAD_ROW',
    document: docLabel(doc),
    where: 'Unread row',
    message: `A row could not be read as an order line: "${text.slice(0, 80)}"`,
  })),
];

/**
 * Check one order's paperwork as a set: client LPO, sales order, invoices
 *
 * The LPO is attached once and kept with the order, so pressing Check again
 * after a fix in Zoho re-reads Zoho and compares against the same LPO. Until
 * the table behind that exists, an LPO attached with the request is still
 * checked; it is simply not kept.
 *
 * @example
 *   await trpcClient.orderChecks.match.mutate({ number: 'SO-00198', lpo: { file, fileName } });
 */
const adminMatchOrder = adminProcedure
  .input(
    z.object({
      number: z.string().trim().min(2).max(40),
      lpo: z.object({ file: z.string().min(20), fileName: z.string().max(200) }).optional(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const [{ salesOrder, invoices }, persisted] = await Promise.all([
      fetchOrderDocuments(input.number),
      orderCheckFilesReady(),
    ]);

    const soNumber = salesOrder?.salesorder_number ?? null;

    /* The LPO: attached now, or kept from an earlier check */
    let stored: StoredFile | null = null;
    if (persisted && soNumber) {
      [stored = null] = await client<StoredFile[]>`
        SELECT f.lpo, f.lpo_read_by AS "lpoReadBy", f.lpo_file_name AS "lpoFileName",
               f.attached_at AS "attachedAt", ua.name AS "attachedBy",
               f.signed_off_at AS "signedOffAt", us.name AS "signedOffBy", f.signed_off_status AS "signedOffStatus"
        FROM order_check_files f
        LEFT JOIN users ua ON ua.id = f.attached_by
        LEFT JOIN users us ON us.id = f.signed_off_by
        WHERE f.so_number = ${soNumber}
      `;
    }

    let lpo = stored?.lpo ?? null;
    let readBy = stored?.lpoReadBy ?? null;
    let fileName = stored?.lpoFileName ?? null;

    if (input.lpo) {
      const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(input.lpo.file);
      const mediaType = match?.[1] ?? (/\.pdf$/i.test(input.lpo.fileName) ? 'application/pdf' : 'image/jpeg');
      const base64 = match?.[2] ?? input.lpo.file;

      const read = await readLpoFile(base64, mediaType);
      if (read.lpo.lines.length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No order lines could be read from that LPO' });
      }
      lpo = read.lpo;
      readBy = read.readBy;
      fileName = input.lpo.fileName;
    }

    const lpoDoc = lpo ? lpoToOrderDoc(lpo) : null;
    const soDoc = salesOrder ? zohoToOrderDoc('sales_order', salesOrder) : null;
    const invoiceDocs = invoices.map((inv) => zohoToOrderDoc('invoice', inv));

    const comparison = compareOrderDocuments({ lpo: lpoDoc, salesOrder: soDoc, invoices: invoiceDocs });
    const findings = [...(lpo && lpoDoc ? lpoSelfCheck(lpo, lpoDoc) : []), ...comparison.findings];
    const counts = {
      error: findings.filter((f) => f.level === 'error').length,
      warning: findings.filter((f) => f.level === 'warning').length,
      info: findings.filter((f) => f.level === 'info').length,
    };
    const status =
      comparison.awaiting.length > 0 ? 'awaiting' : counts.error + counts.warning > 0 ? 'review' : 'matched';

    /*
      Kept: the LPO when one was attached, and the latest result either way,
      so the list of orders shows where each one stands without re-reading
      Zoho for all of them.
    */
    if (persisted && soNumber) {
      try {
        await client`
          INSERT INTO order_check_files (so_number, customer_name, lpo_number, lpo, lpo_read_by, lpo_file_name,
                                         attached_by, attached_at, last_status, last_counts, last_checked_at)
          VALUES (${soNumber}, ${salesOrder?.customer_name ?? null}, ${lpo?.poNumber ?? null},
                  ${lpo ? client.json(JSON.parse(JSON.stringify(lpo))) : null}, ${readBy}, ${fileName},
                  ${input.lpo ? ctx.user.id : null}, ${input.lpo ? new Date().toISOString() : null}::timestamp,
                  ${status}, ${client.json(counts)}, now())
          ON CONFLICT (so_number) DO UPDATE SET
            customer_name = EXCLUDED.customer_name,
            lpo_number = COALESCE(EXCLUDED.lpo_number, order_check_files.lpo_number),
            lpo = COALESCE(EXCLUDED.lpo, order_check_files.lpo),
            lpo_read_by = COALESCE(EXCLUDED.lpo_read_by, order_check_files.lpo_read_by),
            lpo_file_name = COALESCE(EXCLUDED.lpo_file_name, order_check_files.lpo_file_name),
            attached_by = COALESCE(EXCLUDED.attached_by, order_check_files.attached_by),
            attached_at = COALESCE(EXCLUDED.attached_at, order_check_files.attached_at),
            last_status = EXCLUDED.last_status,
            last_counts = EXCLUDED.last_counts,
            last_checked_at = now(),
            updated_at = now()
        `;
      } catch (error) {
        // The check itself stands; only keeping it failed
        logger.error('Could not keep the order check', { soNumber, error });
      }
    }

    const summary = (doc: OrderDoc, extra: { status?: string; date?: string | null }) => ({
      label: docLabel(doc),
      kind: doc.kind,
      number: doc.number,
      customerName: doc.customerName,
      reference: doc.reference,
      currency: doc.currency,
      total: doc.total,
      terms: doc.terms,
      lineCount: doc.lines.length,
      bottles: doc.lines.reduce((s, l) => s + (l.bottles ?? 0), 0),
      ...extra,
    });

    return {
      soNumber,
      customerName: salesOrder?.customer_name ?? invoices[0]?.customer_name ?? null,
      status,
      awaiting: comparison.awaiting,
      findings,
      counts,
      matched: comparison.matched,
      totalLines: comparison.totalLines,
      saleType: comparison.saleType,
      documents: [
        ...(lpoDoc ? [summary(lpoDoc, { date: lpo?.poDate ?? null })] : []),
        ...(soDoc && salesOrder ? [summary(soDoc, { status: salesOrder.status, date: salesOrder.date })] : []),
        ...invoiceDocs.map((d, i) => summary(d, { status: invoices[i]!.status, date: invoices[i]!.date })),
      ],
      lpo: lpo
        ? {
            readBy,
            fileName,
            attachedAt: input.lpo ? new Date() : (stored?.attachedAt ?? null),
            attachedBy: input.lpo ? (ctx.user.name ?? ctx.user.email) : (stored?.attachedBy ?? null),
          }
        : null,
      signOff: stored?.signedOffAt
        ? { at: stored.signedOffAt, by: stored.signedOffBy, status: stored.signedOffStatus }
        : null,
      kept: persisted && !!soNumber,
    };
  });

export default adminMatchOrder;
