import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import { codeBridgeCtes } from '../utils/codeBridge';
import matchCostRows from '../utils/matchCostRows';
import parseCruratedReconSheet from '../utils/parseCruratedReconSheet';
import type { OwnerCostRow } from '../utils/parseCruratedReconSheet';
import parseCruSalesSheet from '../utils/parseCruSalesSheet';
import tableReady from '../utils/tableReady';

/**
 * Take a partner's own price sheet in as what they are owed per bottle
 *
 * Two sheets are understood, recognised by their columns rather than chosen:
 * Crurated's "Payment Run and Recon" workbook (Ocean freight first, the
 * airfreight tabs only for wines that never came by sea) and Cru's "Cru Sales
 * UAE" list (price per case over the case size). Each row is tied to a wine
 * we invoiced for that partner; rows that match nothing are kept and listed,
 * because a price with no wine is something to fix in the sheet, not to lose.
 *
 * Replaces the partner's previous sheet.
 *
 * @param outletId - The outlet, whose invoice lines the rows are matched to
 * @param ownerId - The partner the sheet prices
 * @param file - The workbook, base64
 * @returns How many rows were read and matched, and the ones that were not
 */
const adminImportOwnerCosts = adminProcedure
  .input(
    z.object({
      outletId: z.string().uuid(),
      ownerId: z.string().uuid(),
      file: z.string().min(1).max(14_000_000, 'File is too large (10 MB limit)'),
    }),
  )
  .mutation(async ({ input }) => {
    if (!(await tableReady('cons_owner_costs'))) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message:
          'Partner price sheets are not on this database yet — the migration has not run.',
      });
    }

    let parsed: { rows: OwnerCostRow[]; tabsRead: string[] } | null = null;
    let source = '';
    const reasons: string[] = [];

    for (const [name, parse] of [
      ['crurated-recon', parseCruratedReconSheet],
      ['cru-sales-uae', parseCruSalesSheet],
    ] as const) {
      try {
        parsed = parse(input.file);
        source = name;
        break;
      } catch (error) {
        reasons.push(error instanceof Error ? error.message : String(error));
      }
    }

    if (!parsed || parsed.rows.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `That workbook is not a partner price sheet this page reads. ${reasons.join(' ')}`,
      });
    }

    const candidates = await client<{ lwin18: string | null; productName: string }[]>`
      SELECT DISTINCT m.lwin18, m.product_name AS "productName"
      FROM cons_movements m
      JOIN cons_arrangements a ON a.id = m.arrangement_id
      WHERE a.outlet_id = ${input.outletId}
        AND a.owner_id = ${input.ownerId}
        AND m.kind = 'out'
    `;

    const codes = await client<{ wCode: string; lwin: string }[]>`
      WITH ${codeBridgeCtes(input.outletId, false)}
      SELECT w_code AS "wCode", MIN(lwin) AS lwin
      FROM code_map
      GROUP BY w_code
    `;
    const lwinByWCode = new Map(codes.map((row) => [row.wCode, row.lwin]));

    const matched = matchCostRows(parsed.rows, candidates, lwinByWCode);

    await client.begin(async (sql) => {
      await sql`DELETE FROM cons_owner_costs WHERE owner_id = ${input.ownerId}`;
      await sql`INSERT INTO cons_owner_costs ${sql(
        matched.map((row) => ({
          owner_id: input.ownerId,
          wine_key: row.wineKey,
          lwin18: row.lwin18,
          w_code: row.wCode,
          product_name: row.productName,
          vintage: row.vintage,
          cost_per_bottle: row.costPerBottle,
          tab: row.tab,
          source,
          matched_by: row.matchedBy,
        })),
      )}`;
    });

    const unmatched = matched.filter((row) => !row.wineKey);

    return {
      source,
      tabsRead: parsed.tabsRead,
      rows: matched.length,
      matched: matched.length - unmatched.length,
      unmatched: unmatched
        .slice(0, 40)
        .map(
          (row) =>
            `${row.wCode ? `${row.wCode} · ` : ''}${row.productName}${row.vintage && !row.productName.includes(String(row.vintage)) ? ` ${row.vintage}` : ''}`,
        ),
    };
  });

export default adminImportOwnerCosts;
