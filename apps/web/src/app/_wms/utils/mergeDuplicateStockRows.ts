import { inArray, sql } from 'drizzle-orm';

import db from '@/database/client';
import { wmsStock } from '@/database/schema';

const rowsOf = (result: unknown) =>
  (Array.isArray(result)
    ? result
    : ((result as { rows?: unknown[] }).rows ?? [])) as Array<
    Record<string, unknown>
  >;

export interface MergedDuplicate {
  lwin18: string;
  productName: string;
  ownerName: string;
  keptId: string;
  mergedIds: string[];
  casesBefore: number;
  casesAfter: number;
}

/**
 * Merge stock rows that are the same parcel split in two.
 *
 * A duplicate is the same wine, in the same bay, from the same shipment, for
 * the SAME owner, held the same way (for sale or not). Rows that differ in
 * owner are two partners' wine, not a duplicate — the old dedupe and auto-fix
 * grouped without the owner and deleted one partner's stock as a copy of
 * another's.
 *
 * Merging adds the cases, reservations and open bottles of the extra rows to
 * the oldest row, re-points everything that referenced the extra rows, and then
 * removes them, each group in its own transaction. Nothing is lost: the total
 * in the bay is the same before and after, so no ledger entry is needed.
 *
 * @returns The groups merged, and the wines whose merge was rolled back
 */
const mergeDuplicateStockRows = async () => {
  const groups = rowsOf(
    await db.execute(sql`
      SELECT lwin18, MAX(product_name) AS product_name, MAX(owner_name) AS owner_name,
             ARRAY_AGG(id::text ORDER BY created_at, id) AS stock_ids
        FROM wms_stock
       GROUP BY owner_id, lwin18, location_id, shipment_id, not_for_sale
      HAVING COUNT(*) > 1
    `),
  );

  if (groups.length === 0)
    return { merged: [] as MergedDuplicate[], skipped: [] as string[] };

  // Every column anywhere that points at a wms_stock row
  const foreignKeys = rowsOf(
    await db.execute(sql`
      SELECT cl.relname AS table_name, att.attname AS column_name
        FROM pg_constraint con
        JOIN pg_class cl ON cl.oid = con.conrelid
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
       WHERE con.contype = 'f' AND con.confrelid = 'wms_stock'::regclass
    `),
  ).map((row) => ({
    table: String(row.table_name),
    column: String(row.column_name),
  }));

  /*
    Columns that hold a wms_stock id with no foreign key, so the catalogue
    query above cannot see them. Left behind, a cellar release pinned to the
    merged-away parcel, the movement and pick history, and take-out outflows
    (the payout source) all pointed at a row that no longer existed. Zoho
    order lines are listed too in case their foreign key was never applied.
  */
  const unconstrained = [
    { table: 'private_client_order_items', column: 'source_stock_id' },
    { table: 'wms_stock_movements', column: 'stock_id' },
    { table: 'wms_pick_list_items', column: 'picked_stock_id' },
    { table: 'wms_stock_outflows', column: 'stock_id' },
    { table: 'zoho_sales_order_items', column: 'stock_id' },
  ];

  const references = [...foreignKeys, ...unconstrained].filter(
    (ref, index, all) =>
      all.findIndex((other) => other.table === ref.table && other.column === ref.column) ===
      index,
  );

  const merged: MergedDuplicate[] = [];
  const skipped: string[] = [];

  for (const group of groups) {
    const ids = (group.stock_ids as string[]) ?? [];
    const [keepId, ...extraIds] = ids;
    if (!keepId || extraIds.length === 0) continue;

    const merge = () =>
      db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(wmsStock)
          .where(inArray(wmsStock.id, ids))
          .for('update');

        const keep = rows.find((row) => row.id === keepId);
        const extras = rows.filter((row) => row.id !== keepId);
        if (!keep || extras.length === 0) return null;

        // Still one parcel? Another change may have landed since the scan.
        const sameParcel = extras.every(
          (row) =>
            row.ownerId === keep.ownerId &&
            row.lwin18 === keep.lwin18 &&
            row.locationId === keep.locationId &&
            row.shipmentId === keep.shipmentId &&
            row.notForSale === keep.notForSale,
        );
        if (!sameParcel) return null;

        const sum = (pick: (row: (typeof rows)[number]) => number) =>
          rows.reduce((total, row) => total + pick(row), 0);

        const extraIdList = extras.map((row) => row.id);

        for (const ref of references) {
          await tx.execute(sql`
          UPDATE ${sql.identifier(ref.table)}
             SET ${sql.identifier(ref.column)} = ${keepId}::uuid
           WHERE ${sql.identifier(ref.column)} IN (${sql.join(
             extraIdList.map((id) => sql`${id}::uuid`),
             sql`, `,
           )})
        `);
        }

        await tx
          .update(wmsStock)
          .set({
            quantityCases: sum((row) => row.quantityCases),
            reservedCases: sum((row) => row.reservedCases),
            availableCases: sum((row) => row.availableCases),
            openBottles: sum((row) => row.openBottles),
            updatedAt: new Date(),
          })
          .where(inArray(wmsStock.id, [keepId]));

        await tx.delete(wmsStock).where(inArray(wmsStock.id, extraIdList));

        return {
          lwin18: keep.lwin18,
          productName: keep.productName,
          ownerName: keep.ownerName,
          keptId: keepId,
          mergedIds: extraIdList,
          casesBefore: keep.quantityCases,
          casesAfter: sum((row) => row.quantityCases),
        };
      });

    try {
      const outcome = await merge();
      if (outcome) merged.push(outcome);
    } catch (error) {
      // One group that cannot merge cleanly (a clash on a referencing table)
      // rolls back alone and is left for a person; the others still merge.
      skipped.push(String(group.lwin18));
      console.error(
        '[WMS] Could not merge duplicate stock rows',
        group.lwin18,
        error,
      );
    }
  }

  return { merged, skipped };
};

export default mergeDuplicateStockRows;
