import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

export interface LwinMismatch {
  itemId: string;
  shipmentId: string;
  shipmentReference: string | null;
  productName: string;
  lwin: string;
  /** What the line says it is */
  bottlesPerCase: number | null;
  bottleSizeMl: number | null;
  vintage: number | null;
  cases: number;
  /** What the LWIN's own digits say */
  lwinPack: number;
  lwinSizeMl: number;
  lwinVintage: number;
  /** Which fields disagree, in words */
  differs: string[];
}

/**
 * Shipment lines whose LWIN contradicts the line it was generated from
 *
 * The pack selector could not display a value outside its own list — there is
 * no four-pack in it — so a 4x75cl line rendered as "1 bottle" while holding
 * 4, and touching the control committed the 1. The resulting LWIN then travels:
 * into the WMS as the pack, onto case labels, and into the pick engine's
 * arithmetic.
 *
 * A generated LWIN carries the pack, the vintage and the bottle size in its own
 * digits, so it can be checked against the line that produced it. Where they
 * disagree, one of the two is wrong and the invoice settles which.
 *
 * Non-numeric LWINs are skipped rather than reported: a supplier code adopted
 * as a LWIN has no digits to check and is a separate question.
 */
const adminFindLwinMismatches = adminProcedure.query(async () => {
  const rows = await client<LwinMismatch[]>`
    SELECT
      i.id AS "itemId",
      i.shipment_id AS "shipmentId",
      s.reference_number AS "shipmentReference",
      i.product_name AS "productName",
      i.lwin,
      i.bottles_per_case AS "bottlesPerCase",
      i.bottle_size_ml AS "bottleSizeMl",
      i.vintage,
      i.cases,
      SUBSTRING(i.lwin FROM 14 FOR 2)::int AS "lwinPack",
      SUBSTRING(i.lwin FROM 17 FOR 5)::int AS "lwinSizeMl",
      SUBSTRING(i.lwin FROM 9 FOR 4)::int AS "lwinVintage"
    FROM logistics_shipment_items i
    JOIN logistics_shipments s ON s.id = i.shipment_id
    WHERE i.lwin ~ '^[0-9]{7}-[0-9]{4}-[0-9]{2}-[0-9]{5}$'
    ORDER BY s.created_at DESC, i.product_name
    LIMIT 1000
  `;

  return rows
    .map((row) => {
      const differs: string[] = [];

      if (row.bottlesPerCase && row.bottlesPerCase !== row.lwinPack) {
        differs.push(
          `LWIN says ${row.lwinPack} to a case, the line says ${row.bottlesPerCase}`,
        );
      }

      if (row.bottleSizeMl && row.bottleSizeMl !== row.lwinSizeMl) {
        differs.push(
          `LWIN says ${row.lwinSizeMl}ml, the line says ${row.bottleSizeMl}ml`,
        );
      }

      // 0000 and 1000 are the non-vintage markers, not a disagreement.
      if (
        row.vintage &&
        row.lwinVintage !== 0 &&
        row.lwinVintage !== 1000 &&
        row.vintage !== row.lwinVintage
      ) {
        differs.push(
          `LWIN says ${row.lwinVintage}, the line says ${row.vintage}`,
        );
      }

      return { ...row, differs };
    })
    .filter((row) => row.differs.length > 0);
});

export default adminFindLwinMismatches;
