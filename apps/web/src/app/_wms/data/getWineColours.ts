import { client } from '@/database/client';

import colourFromLivex, { WINE_COLOURS } from '../utils/wineColour';
import type { WineColour } from '../utils/wineColour';

export interface WineWithoutColour {
  /** The wine's code: its LWIN7, or the leading code of a wine without one */
  lwin7: string;
  productName: string | null;
  producer: string | null;
  /** The Liv-ex name, when Liv-ex knows the wine but gives no colour */
  livexName: string | null;
}

interface ColourRow {
  lwin7: string;
  category: string | null;
  productName: string | null;
  producer: string | null;
  livexName: string | null;
  livexColour: string | null;
  livexType: string | null;
  livexSubType: string | null;
  setColour: string | null;
}

/** What a wine's code may look like: digits and letters, no separators */
export const WINE_KEY_PATTERN = /^[A-Za-z0-9]{1,40}$/;

/**
 * The colour of every wine in stock, or of the wines given, keyed by the
 * wine's code (see wineKeyOf)
 *
 * A colour set by staff wins; otherwise it is read from Liv-ex, which knows
 * only seven-digit LWINs. Wines with neither come back in `missing`, which is
 * the list staff work through. Wines given by code need not be in stock yet,
 * so Add to stock can check a wine before its first case is booked.
 *
 * @param keys - Only these wines; omit for every wine held in stock
 */
const getWineColours = async (keys?: string[]) => {
  const wanted = keys ? [...new Set(keys.filter((key) => WINE_KEY_PATTERN.test(key)))] : undefined;
  if (wanted && wanted.length === 0) return { byLwin7: {}, missing: [], notWine: [] };

  const rows = await client<ColourRow[]>`
    WITH wines AS (
      ${
        wanted
          ? client`
              SELECT k.key AS lwin7, st.product_name, st.producer, st.category
              FROM UNNEST(${wanted}::text[]) AS k(key)
              LEFT JOIN LATERAL (
                SELECT s.product_name, s.producer, s.category
                FROM wms_stock s
                WHERE SPLIT_PART(s.lwin18, '-', 1) = k.key
                ORDER BY s.quantity_cases DESC
                LIMIT 1
              ) st ON true
            `
          : client`
              SELECT DISTINCT ON (SPLIT_PART(s.lwin18, '-', 1))
                SPLIT_PART(s.lwin18, '-', 1) AS lwin7,
                s.product_name,
                s.producer,
                s.category
              FROM wms_stock s
              WHERE (s.quantity_cases > 0 OR COALESCE(s.open_bottles, 0) > 0)
                AND SPLIT_PART(s.lwin18, '-', 1) ~ '^[A-Za-z0-9]+$'
              ORDER BY SPLIT_PART(s.lwin18, '-', 1), s.quantity_cases DESC
            `
      }
    )
    SELECT
      w.lwin7,
      w.category,
      w.product_name AS "productName",
      w.producer,
      lw.display_name AS "livexName",
      lw.colour::text AS "livexColour",
      lw.type::text AS "livexType",
      lw.sub_type AS "livexSubType",
      pc.colour AS "setColour"
    FROM wines w
    LEFT JOIN lwin_wines lw ON lw.lwin = w.lwin7
    LEFT JOIN product_colours pc ON pc.lwin7 = w.lwin7
    ORDER BY w.product_name
  `;

  const byLwin7: Record<string, WineColour> = {};
  const missing: WineWithoutColour[] = [];
  /** Spirits and ready-to-drink: no wine colour is asked of them */
  const notWine: string[] = [];

  for (const row of rows) {
    // Stock with no category is wine, as Stock Explorer's Wine tab counts it
    if (row.category && row.category !== 'Wine') {
      notWine.push(row.lwin7);
      continue;
    }

    const set = WINE_COLOURS.find((colour) => colour === row.setColour);
    const colour =
      set ?? colourFromLivex({ colour: row.livexColour, type: row.livexType, subType: row.livexSubType });

    if (colour) {
      byLwin7[row.lwin7] = colour;
    } else {
      missing.push({
        lwin7: row.lwin7,
        productName: row.productName,
        producer: row.producer,
        livexName: row.livexName,
      });
    }
  }

  return { byLwin7, missing, notWine };
};

export default getWineColours;
