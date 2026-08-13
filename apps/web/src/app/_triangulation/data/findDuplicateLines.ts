import { client } from '@/database/client';

export interface DuplicateLine {
  lineId: string;
  description: string | null;
  quantityBottles: number;
  docRef: string | null;
  lineDate: string;
  matchFileName: string | null;
  matchDocRef: string | null;
  matchDate: string;
  daysApart: number;
}

/**
 * How far apart two records of the same shipment can plausibly sit.
 *
 * An invoice is written when the wine ships and the receipt is keyed when it
 * lands, which for wine moving to the UAE is weeks rather than days. Wider than
 * this and it is more likely a genuine repeat order than a double entry.
 */
const WINDOW_DAYS = 120;

/**
 * Find lines in an import that look like stock already counted
 *
 * The same shipment reaches this tool by more than one route — a supplier
 * invoice PDF and an opening-stock spreadsheet describe the same bottles — and
 * committing both silently doubles the receipt. Nothing downstream would catch
 * it: the figures stay plausible and simply overstate what arrived.
 *
 * A line is suspected when another committed import of the same kind holds the
 * same SKU, the same bottle count, within a window that a shipping-to-receiving
 * gap could explain. Deliberately narrow — quantity must match exactly — since
 * a false warning at commit time trains people to click through warnings.
 *
 * @param importId - The import being checked, usually still a draft
 * @returns One entry per suspected line, with the record it collides with
 */
const findDuplicateLines = async (importId: string) => {
  return await client<DuplicateLine[]>`
    SELECT DISTINCT ON (l.id)
      l.id AS "lineId",
      l.raw_description AS description,
      l.quantity_bottles AS "quantityBottles",
      l.doc_ref AS "docRef",
      COALESCE(l.doc_date, i.as_of_date)::text AS "lineDate",
      oi.file_name AS "matchFileName",
      o.doc_ref AS "matchDocRef",
      COALESCE(o.doc_date, oi.as_of_date)::text AS "matchDate",
      ABS(
        COALESCE(o.doc_date, oi.as_of_date) - COALESCE(l.doc_date, i.as_of_date)
      ) AS "daysApart"
    FROM tri_import_lines l
    JOIN tri_imports i ON i.id = l.import_id
    JOIN tri_import_lines o
      ON o.sku_id = l.sku_id
      AND o.id <> l.id
      AND o.quantity_bottles = l.quantity_bottles
      AND o.quantity_bottles <> 0
    JOIN tri_imports oi
      ON oi.id = o.import_id
      AND oi.id <> i.id
      AND oi.kind = i.kind
      AND oi.status = 'committed'
    WHERE l.import_id = ${importId}
      AND l.sku_id IS NOT NULL
      AND ABS(
        COALESCE(o.doc_date, oi.as_of_date) - COALESCE(l.doc_date, i.as_of_date)
      ) <= ${WINDOW_DAYS}
    ORDER BY l.id, "daysApart"
  `;
};

export default findDuplicateLines;
