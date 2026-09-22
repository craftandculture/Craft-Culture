import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

export interface DistributionOutlet {
  id: string;
  name: string;
  connector: string;
  /** When its position was last read, so a stale figure is visibly stale */
  lastSnapshotAt: Date | null;
  consignedLines: number;
  consignedBottles: number;
  /** Consigned wines the outlet holds under no code of ours */
  unmatchedAtOutlet: number;
  /**
   * Every moment we have their position for, newest first.
   *
   * The feed carries no history and takes no date, so this list IS the history
   * — and differencing two of them is what turns a position into a movement.
   * A month with no snapshot at either end can only ever come from an upload.
   */
  snapshotDates: string[];
}

export interface DistributionOwner {
  id: string;
  name: string;
  consignmentTag: string | null;
  takesUnattributed: boolean;
  /** Days until payment falls due here; null is open-ended */
  termsDays: number | null;
  outBottles: number;
}

/**
 * The outlets, the owners, and how fresh each feed is
 *
 * Every screen needs this and none of it is worth a second query. The snapshot
 * date is on it deliberately: a position read three days ago and one read this
 * morning look identical in bottles, and only the date says which you are
 * reading.
 */
const adminGetSetup = adminProcedure.query(async () => {
  const outlets = await client<DistributionOutlet[]>`
    WITH latest AS (
      SELECT outlet_id, MAX(taken_at) AS taken_at
      FROM cons_snapshots GROUP BY outlet_id
    )
    SELECT o.id, o.name, o.connector,
           l.taken_at AS "lastSnapshotAt",
           COALESCE(COUNT(s.id) FILTER (WHERE s.regime = 'consigned'), 0)::int
             AS "consignedLines",
           COALESCE(SUM(s.bottles_on_hand) FILTER (WHERE s.regime = 'consigned'), 0)::float8
             AS "consignedBottles",
           COALESCE(COUNT(s.id) FILTER (
             WHERE s.regime = 'consigned' AND NULLIF(TRIM(s.our_code), '') IS NULL
           ), 0)::int AS "unmatchedAtOutlet"
    FROM cons_outlets o
    LEFT JOIN latest l ON l.outlet_id = o.id
    LEFT JOIN cons_snapshots s
      ON s.outlet_id = o.id AND s.taken_at = l.taken_at
    WHERE o.is_active
    GROUP BY o.id, o.name, o.connector, l.taken_at
    ORDER BY o.name
  `;

  /*
    Taken separately rather than aggregated into the outlet query: the join
    there is already narrowed to the latest moment, and widening it to every
    snapshot would multiply the line counts by the number of days held.
  */
  const history = await client<{ outletId: string; takenAt: string }[]>`
    SELECT DISTINCT outlet_id AS "outletId", taken_at::text AS "takenAt"
    FROM cons_snapshots
    -- Ordered by the output name, not the column: after DISTINCT, Postgres
    -- only knows what is in the select list, and taken_at itself is not.
    ORDER BY "takenAt" DESC
  `;

  const owners = await client<DistributionOwner[]>`
    SELECT ow.id, ow.name, ow.consignment_tag AS "consignmentTag",
           ow.takes_unattributed AS "takesUnattributed",
           a.terms_days AS "termsDays",
           COALESCE(SUM(m.bottles) FILTER (WHERE m.kind = 'out'), 0)::float8
             AS "outBottles"
    FROM cons_owners ow
    LEFT JOIN cons_arrangements a ON a.owner_id = ow.id
    LEFT JOIN cons_movements m ON m.arrangement_id = a.id
    WHERE ow.is_active
    GROUP BY ow.id, ow.name, ow.consignment_tag, ow.takes_unattributed, a.terms_days
    ORDER BY ow.name
  `;

  return {
    outlets: outlets.map((outlet) => ({
      ...outlet,
      snapshotDates: history
        .filter((row) => row.outletId === outlet.id)
        .map((row) => row.takenAt),
    })),
    owners,
  };
});

export default adminGetSetup;
