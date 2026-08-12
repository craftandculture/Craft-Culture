import { client } from '@/database/client';

/**
 * Recompute the canonical bottle figure for every line of an import
 *
 * Bottles are derived, never stored by hand: a bottle-denominated line is its
 * own quantity, a case-denominated one is multiplied by the pack size stated
 * in the file, falling back to the SKU's pack size and then to a 6-pack.
 *
 * Called whenever anything feeding that sum changes — a line being mapped to a
 * SKU, or the import's unit being corrected after upload.
 *
 * @param importId - The import whose lines should be recalculated
 */
const recalculateLineBottles = async (importId: string) => {
  await client`
    UPDATE tri_import_lines l
    SET quantity_bottles = CASE
          WHEN l.unit = 'case' THEN l.quantity * COALESCE(
            l.case_config,
            (SELECT s.case_config FROM tri_skus s WHERE s.id = l.sku_id),
            6
          )
          ELSE l.quantity
        END,
        updated_at = NOW()
    WHERE l.import_id = ${importId}
  `;
};

export default recalculateLineBottles;
