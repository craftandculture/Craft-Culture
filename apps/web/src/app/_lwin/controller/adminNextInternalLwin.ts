/**
 * The next C&C internal LWIN7, and any internal code this wine already has
 *
 * Wines Liv-ex has no LWIN for get a C&C code from 9000001 upwards, written in
 * full LWIN18 shape (`9000008-2021-06-00750`) so every import path that only
 * accepts digits takes it. Real LWIN7s run to about 3.1 million, so the range
 * cannot collide.
 *
 * There is no register table: the codes already in use ARE the register. The
 * next one is one past the highest found anywhere a code can live — stock,
 * shipments, the catalogue, order lines. 9000001–9000007 were handed out from a
 * spreadsheet before any of them reached the system, so the floor sits above
 * them rather than trusting their absence.
 *
 * The same wine must keep the same code, or two Zoho items and two stock lines
 * appear for one bottle. So the lookup also returns internal codes already
 * attached to something with a matching name, to be reused before a new one is
 * taken.
 */

import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

/** Highest code issued before the system tracked them */
const ISSUED_OFF_SYSTEM = 9000007;

const adminNextInternalLwin = adminProcedure
  .input(z.object({ productName: z.string().max(200).optional() }))
  .query(async ({ input }) => {
    const [row] = await client<{ highest: number | null }[]>`
      SELECT MAX(LEFT(code, 7)::int) AS highest
      FROM (
        SELECT lwin18 AS code FROM products
        UNION ALL SELECT lwin FROM logistics_shipment_items
        UNION ALL SELECT lwin18 FROM wms_stock
        UNION ALL SELECT lwin FROM private_client_order_items
      ) codes
      WHERE code ~ '^9[0-9]{6}(-|$|[0-9]{11}$)'
    `;

    const next = Math.max(row?.highest ?? 0, ISSUED_OFF_SYSTEM) + 1;

    /*
      Matched on every word of the name, so "Potensac Medoc" finds
      "Chateau Potensac, Medoc". Loose on purpose: it is a prompt to reuse,
      and the person choosing sees the names side by side.
    */
    const words = (input.productName ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= 3)
      .slice(0, 5);

    const existing =
      words.length === 0
        ? []
        : await client<{ lwin7: string; name: string }[]>`
            SELECT DISTINCT LEFT(code, 7) AS lwin7, name
            FROM (
              SELECT lwin AS code, product_name AS name FROM logistics_shipment_items
              UNION ALL SELECT lwin18, product_name FROM wms_stock
              UNION ALL SELECT lwin, product_name FROM private_client_order_items
            ) codes
            WHERE code ~ '^9[0-9]{6}-'
              AND NOT EXISTS (
                SELECT 1
                FROM unnest(string_to_array(${words.join(' ')}, ' ')) AS word
                WHERE LOWER(name) NOT LIKE '%' || word || '%'
              )
            LIMIT 10
          `;

    return { next: String(next), existing };
  });

export default adminNextInternalLwin;
