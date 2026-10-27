import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import {
  codeBridgeCtes,
  codeBridgeJoins,
  confirmedLinksReady,
  resolvedSnapshotCode,
} from '../utils/codeBridge';
import parseOutletSalesReport from '../utils/parseOutletSalesReport';
import resolveOwner from '../utils/resolveOwner';
import type { OwnerRef } from '../utils/resolveOwner';
import unmatchedReady from '../utils/unmatchedReady';

interface CodeRow {
  outletCode: string;
  lwin18: string | null;
  ownerId: string | null;
  arrangementId: string | null;
  productName: string | null;
  /** How many different owners have sent this wine to the outlet */
  ownerCount: number;
}

/**
 * Take an outlet's monthly sales into the ledger
 *
 * The report is keyed on the outlet's own code and carries no price and no
 * owner. Both come from our side: the wine from the snapshot, which is the only
 * place both codes appear together, and the owner from the wine — because a
 * wine's owner does not change between invoices.
 *
 * Lines that cannot be tied to a wine are **reported, never dropped**. An
 * owner's statement that quietly omits bottles is worse than one that says
 * twelve could not be attributed, and a month that silently shrinks is the one
 * failure nobody notices.
 *
 * Replaces that month rather than appending. A report re-sent with a
 * correction should correct, not double.
 *
 * @param outletId - Which outlet sent the report
 * @param year - The year it covers; the sheet names only a month
 * @param file - The workbook, base64
 * @returns What was taken, what could not be, and whether it agrees with the sheet
 */
const adminImportOutletSales = adminProcedure
  .input(
    z.object({
      outletId: z.string().uuid(),
      year: z.number().int().min(2000).max(2100),
      file: z.string().min(1).max(14_000_000, 'File is too large (10 MB limit)'),
      fileName: z.string().max(300).optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const hasLinks = await confirmedLinksReady();

    const parsed = parseOutletSalesReport(input.file, input.year);

    if (parsed.lines.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'Nothing in that sheet sold anything. Check the month column is the one you meant.',
      });
    }

    /*
      Sales derived from the outlet's stock positions and this report describe
      the same bottles. Taking both would pay the owner twice, so the report is
      refused while any derived window touches this month. (Deriving refuses
      the other way round.)
    */
    const [derived] = await client<{ windows: string | null }[]>`
      SELECT STRING_AGG(DISTINCT m.doc_ref, ', ') AS windows
      FROM cons_movements m
      JOIN cons_arrangements a ON a.id = m.arrangement_id
      WHERE a.outlet_id = ${input.outletId}
        AND m.kind = 'sold'
        AND m.source = 'cd-api-derived'
        AND COALESCE(
              SUBSTRING(m.doc_ref FROM 'Derived (\\d{4}-\\d{2}-\\d{2})')::date,
              m.doc_date
            ) < (${`${parsed.month}-01`}::date + INTERVAL '1 month')
        AND m.doc_date >= ${`${parsed.month}-01`}::date
    `;

    if (derived?.windows) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `Sales for ${parsed.monthLabel} have already been worked out from the stock positions (${derived.windows}). Delete those first so the same bottles are not counted twice.`,
      });
    }

    const owners = await client<OwnerRef[]>`
      SELECT id, name, consignment_tag AS "consignmentTag",
             owner_aliases AS "ownerAliases",
             takes_unattributed AS "takesUnattributed"
      FROM cons_owners WHERE is_active
    `;

    /*
      The outlet's code, the wine it means, and whose it is.

      The snapshot is the bridge: City Drinks publish our code beside their own,
      so it is the one place the two vocabularies meet. The owner comes from
      what we have already invoiced out — a wine sold is a wine we sent.
    */
    const codes = await client<CodeRow[]>`
      WITH latest AS (
        SELECT MAX(taken_at) AS taken_at
        FROM cons_snapshots WHERE outlet_id = ${input.outletId}
      ),
${codeBridgeCtes(input.outletId, hasLinks)},
      /*
        Their report names wines by CDR code and nothing else, so this is the
        one feed where the CDR path is not a fallback but the main road.
      */
      ours AS (
        SELECT s.outlet_code, ${resolvedSnapshotCode()} AS code
        FROM cons_snapshots s
        CROSS JOIN latest
        ${codeBridgeJoins()}
        WHERE s.outlet_id = ${input.outletId}
          AND s.taken_at = latest.taken_at
          AND ${resolvedSnapshotCode()} IS NOT NULL
      ),
      /*
        One row per wine, but counting its owners. Taking the latest sender
        (DISTINCT ON code) handed every sale of a wine two owners both send
        to whichever invoiced last; such a line is flagged instead.
      */
      sent AS (
        SELECT code,
          (ARRAY_AGG(lwin18 ORDER BY doc_date DESC NULLS LAST))[1] AS lwin18,
          (ARRAY_AGG(owner_id ORDER BY doc_date DESC NULLS LAST))[1] AS owner_id,
          (ARRAY_AGG(arrangement_id ORDER BY doc_date DESC NULLS LAST))[1] AS arrangement_id,
          (ARRAY_AGG(product_name ORDER BY doc_date DESC NULLS LAST))[1] AS product_name,
          COUNT(DISTINCT owner_id)::int AS owner_count
        FROM (
          SELECT UPPER(REGEXP_REPLACE(COALESCE(m.lwin18, m.product_name), '[^A-Za-z0-9]', '', 'g')) AS code,
                 m.lwin18, a.owner_id, m.arrangement_id, m.product_name, m.doc_date
          FROM cons_movements m
          JOIN cons_arrangements a ON a.id = m.arrangement_id
          WHERE a.outlet_id = ${input.outletId} AND m.kind = 'out'
        ) lines
        GROUP BY code
      )
      SELECT o.outlet_code AS "outletCode", s.lwin18,
             s.owner_id AS "ownerId", s.arrangement_id AS "arrangementId",
             s.product_name AS "productName",
             COALESCE(s.owner_count, 0) AS "ownerCount"
      FROM ours o
      LEFT JOIN sent s ON s.code = o.code
    `;

    const byOutletCode = new Map(codes.map((row) => [row.outletCode, row]));

    const rows: Record<string, unknown>[] = [];
    const unattributed: string[] = [];
    /* Kept as rows too, so the list outlives the toast that announced it */
    const unmatchedRows: Record<string, unknown>[] = [];
    let unattributedBottles = 0;

    for (const line of parsed.lines) {
      const known = byOutletCode.get(line.outletCode);

      if (known && known.ownerCount > 1) {
        // Two owners have sent this wine and the report names neither.
        // Guessing would pay one for the other's bottles.
        const why = 'sent by more than one owner, so the sale needs attributing by hand';

        unattributed.push(
          `${line.outletCode} · ${line.productName} — ${line.bottles} btl · ${why}`,
        );
        unmatchedRows.push({
          outlet_id: input.outletId,
          month: parsed.month,
          outlet_code: line.outletCode,
          product_name: line.productName,
          bottles: line.bottles,
          reason: why,
        });
        unattributedBottles += line.bottles;
        continue;
      }

      if (!known?.arrangementId) {
        /*
          Either the outlet has never coded this wine to us, or we have no
          record of sending it. Both are real and both are worth naming — a
          bottle sold that we cannot attribute is money nobody will be billed
          for.
        */
        const { reason } = resolveOwner({ tag: null, owners });

        const why = known ? 'never invoiced to this outlet' : reason;

        unattributed.push(
          `${line.outletCode} · ${line.productName} — ${line.bottles} btl · ${why}`,
        );
        unmatchedRows.push({
          outlet_id: input.outletId,
          month: parsed.month,
          outlet_code: line.outletCode,
          product_name: line.productName,
          bottles: line.bottles,
          reason: why,
        });
        unattributedBottles += line.bottles;
        continue;
      }

      rows.push({
        arrangement_id: known.arrangementId,
        kind: 'sold',
        lwin18: known.lwin18,
        product_name: known.productName ?? line.productName,
        outlet_code: line.outletCode,
        bottles: line.bottles,
        source_qty: line.bottles,
        source_unit: 'bottle',
        pack: 1,
        pack_assumed: false,
        // The outlet states no price; value comes from our invoice layers
        doc_ref: input.fileName ?? `${parsed.monthLabel} sales`,
        doc_date: `${parsed.month}-01`,
        source: 'outlet-sales-report',
      });
    }

    const keepsUnmatched = await unmatchedReady();

    // The month is replaced in one transaction: a failure part-way keeps the
    // previous import rather than leaving the month empty
    await client.begin(async (sql) => {
      await sql`
        DELETE FROM cons_movements m
        USING cons_arrangements a
        WHERE m.arrangement_id = a.id
          AND a.outlet_id = ${input.outletId}
          AND m.kind = 'sold'
          AND m.source = 'outlet-sales-report'
          AND TO_CHAR(m.doc_date, 'YYYY-MM') = ${parsed.month}
      `;

      if (rows.length > 0) {
        await sql`INSERT INTO cons_movements ${sql(rows)}`;
      }

      /*
        Replaced wholesale for the month, so re-importing a corrected sheet does
        not leave yesterday's unanswered lines beside today's.
      */
      if (keepsUnmatched) {
        await sql`
          DELETE FROM cons_import_unmatched
          WHERE outlet_id = ${input.outletId} AND month = ${parsed.month}
        `;

        if (unmatchedRows.length > 0) {
          await sql`INSERT INTO cons_import_unmatched ${sql(unmatchedRows)}`;
        }
      }
    });

    return {
      month: parsed.month,
      monthLabel: parsed.monthLabel,
      lines: rows.length,
      bottles: rows.reduce((sum, row) => sum + Number(row.bottles ?? 0), 0),
      /** The sheet's own total, and whether our reading of it agrees */
      declaredBottles: parsed.declaredBottles,
      agrees: parsed.agrees,
      listedUnsold: parsed.counts.noQuantity,
      unattributedBottles,
      unattributed: unattributed.slice(0, 30),
    };
  });

export default adminImportOutletSales;
