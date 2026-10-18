import { client } from '@/database/client';

import getPricingManagerLanded from './getPricingManagerLanded';
import valueFifo from '../utils/valueFifo';
import type { OutLayer } from '../utils/valueFifo';
import wineKey from '../utils/wineKey';
import wineLandedReady from '../utils/wineLandedReady';

export interface StatementLine {
  lwin18: string | null;
  productName: string;
  outletCode: string | null;
  bottlesSold: number;
  /** What we owe the owner per bottle — the landed cost on their shipment */
  costPerBottle: number | null;
  /** The shipment that cost came from */
  costFrom: string | null;
  /** Whether that shipment is this owner's own, rather than a stand-in */
  costIsOwnLine: boolean;
  /** Bottles x cost. Null where no import price is recorded. */
  dueToOwner: number | null;
  /** What City Drinks were billed for those same bottles, FIFO */
  billedToOutlet: number;
  currency: string | null;
  /** Bottles that sold with no invoice layer left to draw from */
  shortBottles: number;
  /** Which of our invoices the value came from */
  drawnFrom: { docRef: string | null; bottles: number; value: number }[];
}

interface SoldRow {
  lwin18: string | null;
  productName: string;
  outletCode: string | null;
  bottles: number;
}

interface LayerRow {
  lwin18: string | null;
  productName: string;
  docDate: string | null;
  docRef: string | null;
  bottles: number;
  unitPrice: number | null;
  pack: number | null;
  currency: string | null;
}

const keyOf = (value: string | null | undefined) =>
  (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * One owner's statement for one month, as both screens read it
 *
 * Extracted so the per-owner statement and the all-partners summary cannot
 * disagree. The summary is the sum of these; written twice, the FIFO would be
 * written twice, and a month would settle to one figure on one screen and
 * another on the next. This module has already lost a day to a key derived
 * slightly differently in two places.
 *
 * @param input - Whose, where and which month
 * @returns The lines, their totals, and the arrangement they belong to
 */
const buildOwnerStatement = async (input: {
  ownerId: string;
  outletId: string;
  month: string;
}) => {
    const [arrangement] = await client<
      { id: string; ownerName: string; outletName: string }[]
    >`
      SELECT a.id, ow.name AS "ownerName", ou.name AS "outletName"
      FROM cons_arrangements a
      JOIN cons_owners ow ON ow.id = a.owner_id
      JOIN cons_outlets ou ON ou.id = a.outlet_id
      WHERE a.owner_id = ${input.ownerId} AND a.outlet_id = ${input.outletId}
      LIMIT 1
    `;

    if (!arrangement) {
      return { lines: [], summary: null, arrangement: null };
    }

    const sold = await client<SoldRow[]>`
      SELECT m.lwin18, MIN(m.product_name) AS "productName",
             MIN(m.outlet_code) AS "outletCode",
             SUM(m.bottles)::float8 AS bottles
      FROM cons_movements m
      WHERE m.arrangement_id = ${arrangement.id}
        AND m.kind = 'sold'
        AND TO_CHAR(m.doc_date, 'YYYY-MM') = ${input.month}
      GROUP BY m.lwin18
      HAVING SUM(m.bottles) > 0
    `;

    if (sold.length === 0) {
      return { lines: [], summary: null, arrangement };
    }

    const layers = await client<LayerRow[]>`
      SELECT m.lwin18, m.product_name AS "productName",
             m.doc_date::text AS "docDate", m.doc_ref AS "docRef",
             m.bottles::float8 AS bottles, m.unit_price AS "unitPrice",
             m.pack, m.currency
      FROM cons_movements m
      WHERE m.arrangement_id = ${arrangement.id} AND m.kind = 'out'
      ORDER BY m.doc_date, m.doc_ref
    `;

    /*
      Bottles this owner sold at this outlet in earlier months. Those layers are
      spent, so this month starts where the last one finished.
    */
    const earlier = await client<{ lwin18: string | null; bottles: number }[]>`
      SELECT m.lwin18, SUM(m.bottles)::float8 AS bottles
      FROM cons_movements m
      WHERE m.arrangement_id = ${arrangement.id}
        AND m.kind = 'sold'
        AND TO_CHAR(m.doc_date, 'YYYY-MM') < ${input.month}
      GROUP BY m.lwin18
    `;

    const lwins = sold
      .map((row) => row.lwin18)
      .filter((value): value is string => Boolean(value));

    /*
      What the wine cost its owner, landed.

      The Pricing Manager is the source: import price plus cost override. Not
      the shipment line — Cru have no shipment lines at all and every bottle of
      theirs priced at nothing, which reads as pure margin on a statement they
      are meant to be paid from.

      Two things the Pricing Manager cannot say on its own, so they are
      remembered here instead:

      A wine that sells out drops off it, taking its cost with it. Fillottes,
      Leflaive Sigma, L'If, Heitz Arvelets, Joaquin and Marsannay 2022 all sold
      through, and a sale made in September still has to be priced in October.
      So the last known cost is kept and used when the live one has gone.

      And one wine can belong to two owners at two costs — Montille Bourgogne
      Blanc and Dancer Hautes-Cotes Blanc are held by both Crurated and Ihab —
      which a price held per wine cannot express. The remembered cost is per
      owner, so each is paid its own.
    */
    const keys = [...new Set(lwins.map((value) => wineKey(value)))];
    const remembers = await wineLandedReady();

    /* Shared with cellar sales of partner wine, so both owe the same figure */
    const live = await getPricingManagerLanded(keys);

    /*
      Written down while it is still there to write down. A wine costed today
      and sold out tomorrow keeps the figure it was costed at, which is the
      whole of what makes a past month still priceable.
    */
    if (remembers && live.length > 0) {
      const byKey = new Map(sold.map((row) => [wineKey(row.lwin18), row]));

      await client`
        INSERT INTO cons_wine_landed ${client(
          live.map((row) => ({
            owner_id: input.ownerId,
            wine_key: row.key,
            lwin18: byKey.get(row.key)?.lwin18 ?? null,
            product_name: byKey.get(row.key)?.productName ?? null,
            landed_per_bottle: row.landedPerBottle,
            source: 'pricing-manager',
          })),
        )}
        ON CONFLICT (owner_id, wine_key) DO UPDATE SET
          landed_per_bottle = EXCLUDED.landed_per_bottle,
          lwin18 = COALESCE(EXCLUDED.lwin18, cons_wine_landed.lwin18),
          product_name = COALESCE(
            EXCLUDED.product_name, cons_wine_landed.product_name
          ),
          source = EXCLUDED.source,
          updated_at = NOW()
      `;
    }

    const remembered = remembers
      ? await client<{ key: string; landedPerBottle: number; source: string }[]>`
          SELECT wine_key AS key, landed_per_bottle::float8 AS "landedPerBottle",
                 source
          FROM cons_wine_landed
          WHERE owner_id = ${input.ownerId}
            AND wine_key = ANY(${keys}::text[])
        `
      : [];

    /*
      An owner's own figure beats the shared one, and a remembered figure beats
      nothing at all. Set by hand wins outright: somebody has looked.
    */
    const costs = keys.map((key) => {
      const kept = remembered.find((row) => row.key === key);
      const now = live.find((row) => row.key === key);
      const chosen =
        kept?.source === 'by-hand'
          ? kept
          : (now ?? kept ?? null);

      return {
        key,
        landedPerBottle: chosen?.landedPerBottle ?? null,
        shipmentNumber:
          chosen === null
            ? null
            : chosen === now
              ? 'Pricing Manager'
              : `last known (${kept?.source ?? 'kept'})`,
        ownLine: true,
      };
    });

    const costByLwin = new Map(costs.map((row) => [row.key, row]));
    const consumedByLwin = new Map(
      earlier.map((row) => [keyOf(row.lwin18), row.bottles]),
    );

    const lines: StatementLine[] = sold.map((row) => {
      const key = keyOf(row.lwin18);

      /*
        The price per BOTTLE. Our invoice states a rate against the unit sold,
        so a 3-pack at 1,698 is 566 a bottle — dividing by the pack is the
        difference between a right and a threefold-wrong settlement.
      */
      const outLayers: OutLayer[] = layers
        .filter((layer) => keyOf(layer.lwin18) === key)
        .map((layer) => ({
          docDate: layer.docDate,
          docRef: layer.docRef,
          bottles: layer.bottles,
          pricePerBottle:
            layer.unitPrice && layer.pack && layer.pack > 0
              ? layer.unitPrice / layer.pack
              : (layer.unitPrice ?? 0),
          currency: layer.currency,
        }));

      const valued = valueFifo(
        outLayers,
        row.bottles,
        consumedByLwin.get(key) ?? 0,
      );

      const costed = costByLwin.get(wineKey(row.lwin18));
      const costPerBottle = costed?.landedPerBottle ?? null;

      return {
        lwin18: row.lwin18,
        productName: row.productName,
        outletCode: row.outletCode,
        bottlesSold: row.bottles,
        costPerBottle,
        /** Never zero where the cost is unknown — that is a silent write-off */
        dueToOwner:
          costPerBottle === null ? null : costPerBottle * row.bottles,
        /** The shipment the landed cost came from, so a figure can be traced */
        costFrom: costed?.shipmentNumber ?? null,
        /** False where the cost came from another owner's shipment line */
        costIsOwnLine: costed?.ownLine ?? false,
        billedToOutlet: valued.value,
        currency: valued.currency,
        shortBottles: valued.shortBottles,
        drawnFrom: valued.drawnFrom,
      };
    });

    const summary = lines.reduce(
      (totals, line) => ({
        wines: totals.wines + 1,
        bottles: totals.bottles + line.bottlesSold,
        dueToOwner: totals.dueToOwner + (line.dueToOwner ?? 0),
        billedToOutlet: totals.billedToOutlet + line.billedToOutlet,
        /** Bottles with no import price, so nothing can be owed for them yet */
        withoutCost: totals.withoutCost + (line.dueToOwner === null ? 1 : 0),
        shortBottles: totals.shortBottles + line.shortBottles,
      }),
      {
        wines: 0,
        bottles: 0,
        dueToOwner: 0,
        billedToOutlet: 0,
        withoutCost: 0,
        shortBottles: 0,
      },
    );

    return {
      arrangement,
      month: input.month,
      lines: lines.sort((a, b) => b.bottlesSold - a.bottlesSold),
      summary: {
        ...summary,
        /** What C&C keeps: billed to the outlet, less owed to the owner */
        margin: summary.billedToOutlet - summary.dueToOwner,
      },
    };
};

export default buildOwnerStatement;
