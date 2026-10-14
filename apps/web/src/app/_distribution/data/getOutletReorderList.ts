import normalizeLwin18 from '@/app/_wms/utils/normalizeLwin18';
import { client } from '@/database/client';

import getCcSupplyPositions, { familyKeyOf, wineKeyOf } from './getCcSupplyPositions';
import type { SupplyPosition } from './getCcSupplyPositions';
import assessReorder from '../utils/assessReorder';
import {
  codeBridgeCtes,
  codeBridgeJoins,
  confirmedLinksReady,
  packAgnostic,
  resolvedSnapshotCode,
} from '../utils/codeBridge';
import wineOwnersReady from '../utils/wineOwnersReady';

/** An invoice line's code, squashed as the snapshot codes are */
const squashed = () =>
  client`UPPER(REGEXP_REPLACE(COALESCE(m.lwin18, m.product_name), '[^A-Za-z0-9]', '', 'g'))`;

interface PositionRow {
  code: string;
  lwin: string | null;
  productName: string | null;
  regime: string | null;
  held: number;
  inTransit: number;
  sold30: number;
  sold90: number;
}

export interface ReorderLine {
  wine: string;
  /**
   * Who acts on it: "C&C" for our wine and for anything they bought from us
   * outright, otherwise the consignor whose wine it is
   */
  owner: string;
  lwin18: string;
  status: 'oos' | 'low';
  regime: string | null;
  held: number;
  inTransit: number;
  sold30: number;
  daysCover: number | null;
  suggestBottles: number;
  suggestCases: number;
  pack: number;
  supply: SupplyPosition | null;
  /** Other vintages we hold or have coming, when this one is short */
  alternatives: Array<{ vintage: string; stock: number; inbound: number }>;
}

/**
 * Wines a distributor is out of or running low on, and what we can send
 *
 * Read from the outlet's latest stock snapshot only — their position now,
 * with their own 30- and 90-day sales. Lines are matched to our wines through
 * the same code bridge as the sales report, pack-agnostically, so a wine they
 * hold as singles and as cases is one position. Lines that never resolve to
 * a LWIN are their own stock, not ours to replenish, and are left out.
 *
 * Out of stock first, then the fewest days left.
 *
 * @param outletId - The outlet (City Drinks)
 * @returns The snapshot time and the lines needing an order
 */
const getOutletReorderList = async (outletId: string) => {
  const hasLinks = await confirmedLinksReady();
  const hasOwners = await wineOwnersReady();

  const rows = await client<(PositionRow & { takenAt: Date; ownerName: string | null })[]>`
    WITH latest AS (
      SELECT MAX(taken_at) AS taken_at FROM cons_snapshots WHERE outlet_id = ${outletId}
    ),
    ${codeBridgeCtes(outletId, hasLinks)},
    /* Whose wine it is — the same reading as the daily sales report */
    outs AS (
      SELECT ${packAgnostic(squashed)} AS code, m.doc_date, a.owner_id
      FROM cons_movements m
      JOIN cons_arrangements a ON a.id = m.arrangement_id
      WHERE a.outlet_id = ${outletId} AND m.kind = 'out'
    ),
    invoiced_owner AS (
      SELECT DISTINCT ON (o.code) o.code, ow.name AS owner_name
      FROM outs o
      JOIN cons_owners ow ON ow.id = o.owner_id
      ORDER BY o.code, o.doc_date DESC NULLS LAST
    ),
    stated_owner AS (
      ${
        hasOwners
          ? client`
              SELECT DISTINCT ON (code) code, owner_name
              FROM (
                SELECT ${packAgnostic(
                  () => client`UPPER(REGEXP_REPLACE(w.lwin18, '[^A-Za-z0-9]', '', 'g'))`,
                )} AS code, ow.name AS owner_name
                FROM cons_wine_owners w
                JOIN cons_owners ow ON ow.id = w.owner_id
                WHERE w.outlet_id = ${outletId}
              ) stated
              ORDER BY code
            `
          : client`SELECT NULL::text AS code, NULL::text AS owner_name WHERE false`
      }
    ),
    owner_of AS (
      SELECT COALESCE(s.code, i.code) AS code, COALESCE(s.owner_name, i.owner_name) AS owner_name
      FROM stated_owner s
      FULL JOIN invoiced_owner i ON i.code = s.code
    ),
    pos AS (
    SELECT ${packAgnostic(() => resolvedSnapshotCode())} AS code,
           MIN(${resolvedSnapshotCode()}) AS lwin,
           MIN(s.product_name) AS "productName",
           MIN(s.regime) AS regime,
           MAX(s.taken_at) AS "takenAt",
           SUM(s.bottles_on_hand)::float8 AS held,
           SUM(s.bottles_in_transit)::float8 AS "inTransit",
           COALESCE(SUM(s.sold_last_30d), 0)::float8 AS sold30,
           COALESCE(SUM(s.sold_last_90d), 0)::float8 AS sold90
    FROM cons_snapshots s
    ${codeBridgeJoins()}
    WHERE s.outlet_id = ${outletId}
      AND s.taken_at = (SELECT taken_at FROM latest)
    GROUP BY 1
    )
    SELECT pos.*, o.owner_name AS "ownerName"
    FROM pos
    LEFT JOIN owner_of o ON o.code = pos.code
  `;

  const { positions, families } = await getCcSupplyPositions();
  const lines: ReorderLine[] = [];

  for (const row of rows) {
    const lwin18 = normalizeLwin18(String(row.lwin ?? ''));
    const key = wineKeyOf(lwin18);
    if (!key || !/^\d{7}-/.test(lwin18)) continue;

    const supply = positions.get(key) ?? null;
    const pack = supply?.pack ?? (Number(lwin18.split('-')[2]) || 6);
    const verdict = assessReorder({
      held: Number(row.held) || 0,
      inTransit: Number(row.inTransit) || 0,
      sold30: Number(row.sold30) || 0,
      sold90: Number(row.sold90) || 0,
      pack,
    });
    if (!verdict.status) continue;

    const vintage = lwin18.split('-')[1] ?? '';
    const ownCover = (supply?.stock ?? 0) + (supply?.consignor ?? 0) + (supply?.inbound ?? 0);
    const family = familyKeyOf(lwin18);
    // Other years only matter when we cannot supply this one
    const alternatives =
      ownCover > 0 || !family
        ? []
        : [...(families.get(family) ?? new Map()).entries()]
            .filter(([year, v]) => year !== vintage && (v.stock > 0 || v.inbound > 0))
            .map(([year, v]) => ({ vintage: year === '0000' ? 'NV' : year, ...v }))
            .sort((a, b) => b.vintage.localeCompare(a.vintage))
            .slice(0, 3);

    /*
      Bought outright, it is our customer's reorder from us whoever supplied
      it first; consigned, it is the consignor's call.
    */
    const owner =
      row.regime === 'bought' || /craft/i.test(row.ownerName ?? '')
        ? 'C&C'
        : (row.ownerName ?? 'Owner unknown');

    lines.push({
      wine: (row.productName ?? lwin18).trim(),
      owner,
      lwin18,
      status: verdict.status,
      regime: row.regime,
      held: Number(row.held) || 0,
      inTransit: Number(row.inTransit) || 0,
      sold30: Number(row.sold30) || 0,
      daysCover: verdict.daysCover,
      suggestBottles: verdict.suggestBottles,
      suggestCases: verdict.suggestCases,
      pack,
      supply,
      alternatives,
    });
  }

  lines.sort((a, b) =>
    a.status !== b.status
      ? a.status === 'oos'
        ? -1
        : 1
      : (a.daysCover ?? 0) - (b.daysCover ?? 0) || b.sold30 - a.sold30,
  );

  return { takenAt: rows[0]?.takenAt ?? null, lines };
};

export default getOutletReorderList;
