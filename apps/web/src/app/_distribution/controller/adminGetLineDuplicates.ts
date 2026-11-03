import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import { isLwin18 } from '../utils/canonicalWineCode';
import groupDuplicateLines from '../utils/groupDuplicateLines';
import type { LineCode } from '../utils/groupDuplicateLines';
import wineKey from '../utils/wineKey';

/**
 * Every code a wine is held under at the outlet, and the ones that look alike
 *
 * Proposals for the merge tool, plus the full list so a pair the names do not
 * give away (a misspelling — "Fraggnano … Pravo" for Fregonese Prapò) can be
 * merged by hand.
 *
 * @param outletId - The outlet
 * @returns Proposed groups, every code, and the codes that are not a LWIN18
 */
const adminGetLineDuplicates = adminProcedure
  .input(z.object({ outletId: z.string().uuid() }))
  .query(async ({ input }) => {
    const rows = await client<
      { code: string; name: string; kind: string; bottles: number }[]
    >`
      SELECT COALESCE(m.lwin18, m.product_name) AS code,
             MIN(m.product_name) AS name, m.kind::text AS kind,
             SUM(m.bottles)::float8 AS bottles
      FROM cons_movements m
      JOIN cons_arrangements a ON a.id = m.arrangement_id
      WHERE a.outlet_id = ${input.outletId}
        AND m.kind IN ('out', 'sold')
      GROUP BY COALESCE(m.lwin18, m.product_name), m.kind
    `;

    const byKey = new Map<string, LineCode>();

    for (const row of rows) {
      const key = wineKey(row.code);
      const existing = byKey.get(key);
      const line: LineCode = existing ?? {
        key,
        code: row.code,
        name: row.name,
        outBottles: 0,
        soldBottles: 0,
      };

      /* Prefer to show the code in its canonical form where the key has one */
      if (!isLwin18(line.code) && isLwin18(row.code)) line.code = row.code;

      if (row.kind === 'out') line.outBottles += row.bottles;
      else line.soldBottles += row.bottles;

      byKey.set(key, line);
    }

    const lines = [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));

    return {
      groups: groupDuplicateLines(lines),
      lines,
      notLwin: lines.filter((line) => !isLwin18(line.code)),
    };
  });

export default adminGetLineDuplicates;
