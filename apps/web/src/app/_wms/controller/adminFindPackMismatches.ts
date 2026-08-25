import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

export interface PackMismatch {
  stockId: string;
  locationCode: string | null;
  ownerName: string | null;
  productName: string;
  lwin18: string;
  supplierSku: string | null;
  /** What the stock row says it is */
  caseConfig: number | null;
  bottleSize: string | null;
  vintage: number | null;
  quantityCases: number;
  openBottles: number;
  /** What the LWIN's own digits say */
  lwinPack: number;
  lwinSizeMl: number;
  lwinVintage: number;
  /** Bottles at each reading, which is the size of the exposure */
  bottlesByRow: number;
  bottlesByLwin: number;
  differs: string[];
}

/**
 * Stock whose pack disagrees with its own LWIN
 *
 * This is where a wrong pack costs money rather than merely reads oddly. The
 * pick engine cracks cases by `case_config`, so a six-pack recorded as a
 * twelve cracks half the cases it should and the order ships short — which is
 * exactly the shape of the complaint that started this.
 *
 * An LWIN-18 states the pack, the vintage and the bottle size in its own
 * digits, so every stock row carrying one can be checked against itself. Where
 * the two disagree the bottle count is wrong by the ratio between them, and
 * that number is reported rather than left to be worked out.
 *
 * Rows with a non-numeric LWIN are skipped: a supplier reference in that column
 * has no digits to check.
 */
const adminFindPackMismatches = adminProcedure.query(async () => {
  const rows = await client<PackMismatch[]>`
    SELECT
      s.id AS "stockId",
      l.location_code AS "locationCode",
      s.owner_name AS "ownerName",
      s.product_name AS "productName",
      s.lwin18,
      s.supplier_sku AS "supplierSku",
      s.case_config AS "caseConfig",
      s.bottle_size AS "bottleSize",
      s.vintage,
      s.quantity_cases AS "quantityCases",
      COALESCE(s.open_bottles, 0) AS "openBottles",
      SUBSTRING(s.lwin18 FROM 14 FOR 2)::int AS "lwinPack",
      SUBSTRING(s.lwin18 FROM 17 FOR 5)::int AS "lwinSizeMl",
      SUBSTRING(s.lwin18 FROM 9 FOR 4)::int AS "lwinVintage"
    FROM wms_stock s
    LEFT JOIN wms_locations l ON l.id = s.location_id
    WHERE s.lwin18 ~ '^[0-9]{7}-[0-9]{4}-[0-9]{2}-[0-9]{5}$'
      AND (s.quantity_cases > 0 OR COALESCE(s.open_bottles, 0) > 0)
    ORDER BY s.quantity_cases DESC
    LIMIT 1000
  `;

  return rows
    .map((row) => {
      const differs: string[] = [];

      if (row.caseConfig && row.caseConfig !== row.lwinPack) {
        differs.push(
          `stock is filed as ${row.caseConfig} to a case, its LWIN says ${row.lwinPack}`,
        );
      }

      // '75cl' and '750ml' are the same bottle written two ways, so compare in
      // millilitres rather than as text.
      const sizeDigits = Number(
        (row.bottleSize ?? '').replace(/[^0-9]/g, '') || 0,
      );
      const rowSizeMl = /cl/i.test(row.bottleSize ?? '')
        ? sizeDigits * 10
        : sizeDigits;

      if (rowSizeMl > 0 && rowSizeMl !== row.lwinSizeMl) {
        differs.push(`bottle is ${rowSizeMl}ml, its LWIN says ${row.lwinSizeMl}ml`);
      }

      if (
        row.vintage &&
        row.lwinVintage !== 0 &&
        row.lwinVintage !== 1000 &&
        row.vintage !== row.lwinVintage
      ) {
        differs.push(`vintage is ${row.vintage}, its LWIN says ${row.lwinVintage}`);
      }

      return {
        ...row,
        differs,
        bottlesByRow:
          row.quantityCases * (row.caseConfig ?? 0) + row.openBottles,
        bottlesByLwin: row.quantityCases * row.lwinPack + row.openBottles,
      };
    })
    .filter((row) => row.differs.length > 0);
});

export default adminFindPackMismatches;
