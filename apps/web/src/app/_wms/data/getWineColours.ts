import { client } from '@/database/client';

import colourFromLivex, { WINE_COLOURS } from '../utils/wineColour';
import type { WineColour } from '../utils/wineColour';

export interface WineWithoutColour {
  lwin7: string;
  productName: string;
  producer: string | null;
  /** The Liv-ex name, when Liv-ex knows the wine but gives no colour */
  livexName: string | null;
}

interface ColourRow {
  lwin7: string;
  productName: string;
  producer: string | null;
  livexName: string | null;
  livexColour: string | null;
  livexType: string | null;
  livexSubType: string | null;
  setColour: string | null;
}

/**
 * The colour of every wine in stock, or of the wines given, keyed by LWIN7
 *
 * A colour set by staff wins; otherwise it is read from Liv-ex. Wines with
 * neither come back in `missing`, which is the list staff work through. Stock
 * without a seven-digit LWIN (a supplier code in the LWIN column) has no wine
 * to look up, and is left out.
 *
 * @param lwin7s - Only these wines; omit for every wine held in stock
 */
const getWineColours = async (lwin7s?: string[]) => {
  const wanted = lwin7s?.filter((code) => /^[0-9]{7}$/.test(code));
  if (wanted && wanted.length === 0) return { byLwin7: {}, missing: [] };

  const rows = await client<ColourRow[]>`
    WITH wines AS (
      SELECT DISTINCT ON (SUBSTRING(s.lwin18 FROM 1 FOR 7))
        SUBSTRING(s.lwin18 FROM 1 FOR 7) AS lwin7,
        s.product_name,
        s.producer
      FROM wms_stock s
      WHERE s.lwin18 ~ '^[0-9]{7}'
        ${
          wanted
            ? client`AND SUBSTRING(s.lwin18 FROM 1 FOR 7) = ANY(${wanted}::text[])`
            : client`AND (s.quantity_cases > 0 OR COALESCE(s.open_bottles, 0) > 0)`
        }
      ORDER BY SUBSTRING(s.lwin18 FROM 1 FOR 7), s.quantity_cases DESC
    )
    SELECT
      w.lwin7,
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

  for (const row of rows) {
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

  return { byLwin7, missing };
};

export default getWineColours;
