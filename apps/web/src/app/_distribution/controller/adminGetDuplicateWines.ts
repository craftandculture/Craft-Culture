import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import { packAgnostic } from '../utils/codeBridge';
import MISCODED_VINTAGES from '../utils/miscodedVintages';
import MISREAD_PAIRS from '../utils/misreadPairs';

export interface DuplicateMember {
  id: string;
  lwin18: string;
  name: string;
  producer: string | null;
  year: number | null;
  /** Bottles this record holds in the warehouse */
  stockBottles: number;
  /** Consignment lines invoiced out under it */
  movementLines: number;
  consignedBottles: number;
}

export interface DuplicateGroup {
  /** What makes these one wine: a shared key, or a name Sophie identified */
  reason: string;
  /** The record the others would fold into — the one carrying the most history */
  survivor: DuplicateMember;
  duplicates: DuplicateMember[];
}

/**
 * Wines recorded more than once, and what merging them would cost
 *
 * Proposes and never acts. A merge moves stock, invoices and consignment
 * positions from one record onto another, and the wrong one costs an owner
 * their bottles — so this returns a list to read, and the merging is a
 * separate, confirmed act.
 *
 * Three kinds of duplicate, kept apart because they are not equally safe:
 *
 * The key is `packAgnostic` from `codeBridge`, not a rule written again here.
 * A duplicate this screen cannot see is a duplicate the balances have already
 * merged, and two definitions of one wine is the fault this page exists to
 * find.
 *
 * 1. **One wine under two LWINs that differ only by pack.** Arithmetically
 *    certain: same wine, same vintage, same bottle size, invoiced in sixes on
 *    one document and singles on another. The lots stay separate — a 3-pack
 *    and a 6-pack are different lots of one wine, and the pack belongs to the
 *    lot, not to the wine.
 * 2. **A name Sophie identified as a misreading.** "Fournier" for Fourrier.
 *    Listed by hand in `misreadPairs`, because one letter separates a
 *    misreading from a different estate and no distance measure knows which.
 * 3. **The same producer, vintage and size under two codes.** A proposal only:
 *    these are where a person is actually needed.
 *
 * @returns Groups to review, and the vintage corrections, which are not merges
 */
const adminGetDuplicateWines = adminProcedure.query(async () => {
  /*
    Everything a merge would move. A record with no stock, no invoice and no
    consignment position costs nothing to fold away; one carrying all three is
    where the care is owed, and the difference should be on the screen rather
    than in the reviewer's head.
  */
  type Row = DuplicateMember & { packAgnostic: string; squashedName: string };

  const rows: Row[] = await client<Row[]>`
    SELECT p.id, p.lwin18, p.name, p.producer, p.year,
           COALESCE(st.bottles, 0)::float8 AS "stockBottles",
           COALESCE(mv.lines, 0)::int AS "movementLines",
           COALESCE(mv.bottles, 0)::float8 AS "consignedBottles",
           ${packAgnostic(
             () => client`UPPER(REGEXP_REPLACE(p.lwin18, '[^A-Za-z0-9]', '', 'g'))`,
           )} AS "packAgnostic",
           UPPER(REGEXP_REPLACE(p.name, '[^A-Za-z0-9]', '', 'g')) AS "squashedName"
    FROM products p
    LEFT JOIN (
      SELECT lwin18, SUM(quantity)::float8 AS bottles
      FROM wms_stock GROUP BY lwin18
    ) st ON st.lwin18 = p.lwin18
    LEFT JOIN (
      SELECT lwin18, COUNT(*)::int AS lines, SUM(bottles)::float8 AS bottles
      FROM cons_movements WHERE kind = 'out' GROUP BY lwin18
    ) mv ON mv.lwin18 = p.lwin18
    WHERE p.lwin18 ~ '^[0-9]{18}$'
  `;

  const strip = ({ packAgnostic: _p, squashedName: _s, ...rest }: Row) => rest;

  /* The record carrying the most history survives, so the least is moved */
  const weight = (row: Row) =>
    row.consignedBottles * 1000 + row.stockBottles * 10 + row.movementLines;

  const groups: DuplicateGroup[] = [];
  const claimed = new Set<string>();

  const addGroup = (members: Row[], reason: string) => {
    if (members.length < 2) return;

    const ordered = [...members].sort((a, b) => weight(b) - weight(a));
    const [survivor, ...duplicates] = ordered;

    if (!survivor) return;

    ordered.forEach((row) => claimed.add(row.id));
    groups.push({
      reason,
      survivor: strip(survivor),
      duplicates: duplicates.map(strip),
    });
  };

  /* 1. Same wine, same size, different pack */
  const byPack = new Map<string, Row[]>();

  for (const row of rows) {
    byPack.set(row.packAgnostic, [...(byPack.get(row.packAgnostic) ?? []), row]);
  }

  for (const [, members] of byPack) {
    if (members.length > 1) {
      addGroup(members, 'One wine, invoiced in different pack sizes');
    }
  }

  /* 2. The misreadings, matched on the name as recorded */
  for (const pair of MISREAD_PAIRS) {
    const wrong = rows.filter(
      (row) =>
        !claimed.has(row.id) &&
        row.name.toLowerCase().includes(pair.wrong.toLowerCase()),
    );
    const right = rows.filter(
      (row) =>
        !claimed.has(row.id) &&
        row.name.toLowerCase().includes(pair.right.toLowerCase()),
    );

    if (wrong.length && right.length) {
      addGroup(
        [...right, ...wrong],
        `"${pair.wrong}" is a misreading of "${pair.right}" — ${pair.note}`,
      );
    }
  }

  /* 3. Same producer, vintage and size, under two codes. A proposal only. */
  const byProducer = new Map<string, Row[]>();

  for (const row of rows) {
    if (claimed.has(row.id) || !row.producer || !row.year) continue;

    const key = `${row.producer.toLowerCase().trim()}|${row.year}|${row.lwin18.slice(13)}`;

    byProducer.set(key, [...(byProducer.get(key) ?? []), row]);
  }

  for (const [, members] of byProducer) {
    if (members.length > 1) {
      addGroup(
        members,
        'Same producer, vintage and bottle size under two codes — needs a person',
      );
    }
  }

  return {
    groups: groups.sort(
      (a, b) =>
        b.duplicates.reduce((sum, row) => sum + row.consignedBottles, 0) -
        a.duplicates.reduce((sum, row) => sum + row.consignedBottles, 0),
    ),
    /* Not merges. One wine, wrongly keyed, and re-keying moves its lot. */
    miscodedVintages: MISCODED_VINTAGES.map((entry) => ({
      ...entry,
      matches: rows
        .filter((row) =>
          row.name.toLowerCase().includes(entry.wine.toLowerCase()),
        )
        .map(strip),
    })),
  };
});

export default adminGetDuplicateWines;
