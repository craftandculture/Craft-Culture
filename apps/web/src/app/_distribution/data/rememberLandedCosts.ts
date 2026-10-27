import { client } from '@/database/client';

import getPricingManagerLanded from './getPricingManagerLanded';
import wineKey from '../utils/wineKey';
import wineLandedReady from '../utils/wineLandedReady';

/**
 * Keep the last known landed cost of every consigned wine, per owner
 *
 * A wine that sells out drops off the Pricing Manager and takes its cost with
 * it, yet a sale made last month still has to be priced on this month's
 * statement. So the live cost is written down while it is still there.
 *
 * This used to happen inside the statement itself, which meant opening a
 * statement (a read) wrote to the database, and opening an old month overwrote
 * what was remembered with today's figure. It now runs from the daily cron. A
 * cost set by hand is never overwritten.
 *
 * @returns How many owner-wine costs were written
 */
const rememberLandedCosts = async () => {
  if (!(await wineLandedReady())) return { written: 0 };

  const wines = await client<
    { ownerId: string; lwin18: string; productName: string | null }[]
  >`
    SELECT DISTINCT ON (a.owner_id, m.lwin18)
           a.owner_id AS "ownerId", m.lwin18, m.product_name AS "productName"
    FROM cons_movements m
    JOIN cons_arrangements a ON a.id = m.arrangement_id
    WHERE m.kind = 'out' AND m.lwin18 IS NOT NULL
    ORDER BY a.owner_id, m.lwin18, m.doc_date DESC NULLS LAST
  `;

  if (wines.length === 0) return { written: 0 };

  const keys = [...new Set(wines.map((row) => wineKey(row.lwin18)))];
  const live = new Map(
    (await getPricingManagerLanded(keys)).map((row) => [row.key, row]),
  );

  const rows = new Map<string, Record<string, unknown>>();

  for (const wine of wines) {
    const key = wineKey(wine.lwin18);
    const cost = live.get(key);

    if (!cost) continue;

    // One row per owner and wine key (several LWINs can share a pack-agnostic key)
    rows.set(`${wine.ownerId}|${key}`, {
      owner_id: wine.ownerId,
      wine_key: key,
      lwin18: wine.lwin18,
      product_name: wine.productName,
      landed_per_bottle: cost.landedPerBottle,
      source: 'pricing-manager',
    });
  }

  if (rows.size === 0) return { written: 0 };

  const written = await client<{ ownerId: string }[]>`
    INSERT INTO cons_wine_landed ${client([...rows.values()])}
    ON CONFLICT (owner_id, wine_key) DO UPDATE SET
      landed_per_bottle = EXCLUDED.landed_per_bottle,
      lwin18 = COALESCE(EXCLUDED.lwin18, cons_wine_landed.lwin18),
      product_name = COALESCE(EXCLUDED.product_name, cons_wine_landed.product_name),
      source = EXCLUDED.source,
      updated_at = NOW()
    WHERE cons_wine_landed.source IS DISTINCT FROM 'by-hand'
    RETURNING owner_id AS "ownerId"
  `;

  return { written: written.length };
};

export default rememberLandedCosts;
