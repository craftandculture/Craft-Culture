import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import {
  codeBridgeCtes,
  codeBridgeJoins,
  resolvedSnapshotCode,
} from '../utils/codeBridge';
import parseOutletSalesReport from '../utils/parseOutletSalesReport';
import resolveOwner from '../utils/resolveOwner';
import type { OwnerRef } from '../utils/resolveOwner';

interface CodeRow {
  outletCode: string;
  lwin18: string | null;
  ownerId: string | null;
  arrangementId: string | null;
  productName: string | null;
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
      file: z.string().min(1),
      fileName: z.string().max(300).optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const parsed = parseOutletSalesReport(input.file, input.year);

    if (parsed.lines.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'Nothing in that sheet sold anything. Check the month column is the one you meant.',
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
${codeBridgeCtes(input.outletId)},
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
            sent AS (
        SELECT DISTINCT ON (code) code, lwin18, owner_id, arrangement_id, product_name
        FROM (
          SELECT UPPER(REGEXP_REPLACE(COALESCE(m.lwin18, m.product_name), '[^A-Za-z0-9]', '', 'g')) AS code,
                 m.lwin18, a.owner_id, m.arrangement_id, m.product_name, m.doc_date
          FROM cons_movements m
          JOIN cons_arrangements a ON a.id = m.arrangement_id
          WHERE a.outlet_id = ${input.outletId} AND m.kind = 'out'
        ) lines
        ORDER BY code, doc_date DESC NULLS LAST
      )
      SELECT o.outlet_code AS "outletCode", s.lwin18,
             s.owner_id AS "ownerId", s.arrangement_id AS "arrangementId",
             s.product_name AS "productName"
      FROM ours o
      LEFT JOIN sent s ON s.code = o.code
    `;

    const byOutletCode = new Map(codes.map((row) => [row.outletCode, row]));

    const rows: Record<string, unknown>[] = [];
    const unattributed: string[] = [];
    let unattributedBottles = 0;

    for (const line of parsed.lines) {
      const known = byOutletCode.get(line.outletCode);

      if (!known?.arrangementId) {
        /*
          Either the outlet has never coded this wine to us, or we have no
          record of sending it. Both are real and both are worth naming — a
          bottle sold that we cannot attribute is money nobody will be billed
          for.
        */
        const { reason } = resolveOwner({ tag: null, owners });

        unattributed.push(
          `${line.outletCode} · ${line.productName} — ${line.bottles} btl · ${known ? 'never invoiced to this outlet' : reason}`,
        );
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

    await client`
      DELETE FROM cons_movements m
      USING cons_arrangements a
      WHERE m.arrangement_id = a.id
        AND a.outlet_id = ${input.outletId}
        AND m.kind = 'sold'
        AND m.source = 'outlet-sales-report'
        AND TO_CHAR(m.doc_date, 'YYYY-MM') = ${parsed.month}
    `;

    if (rows.length > 0) {
      await client`INSERT INTO cons_movements ${client(rows)}`;
    }

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
