import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import { packAgnostic } from '../utils/codeBridge';
import valueFifo from '../utils/valueFifo';
import type { OutLayer } from '../utils/valueFifo';
import wineKey from '../utils/wineKey';

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
 * What to tell an owner sold this month, and what we owe them for it
 *
 * The output the whole module exists for. City Drinks never send a settlement
 * invoice — we bill them. The owners are the other way round: we tell them what
 * sold and they invoice us against it, so this statement is what starts the
 * settlement rather than a report on one that happened.
 *
 * Two prices per bottle, which is the thing Sophie's sheet could not show.
 *
 * **What we owe the owner** is the landed cost on their own shipment line —
 * freight and transfer included, read from `logistics_shipment_items`, which
 * `lotShipmentCost` names as the one place that question is decided. Where a
 * wine has no landed cost the line says so and is counted as unknown. Never as
 * nil: a bottle costing zero is a silent write-off of whatever it really cost,
 * and it would read as pure margin.
 *
 * **What City Drinks owe us** is drawn FIFO from the consignment invoices that
 * actually put those bottles there — the lines Zoho carries a CONSIGNMENT tag
 * against, since an outright sale is not ours to settle.
 *
 * The gap between the two is C&C's margin, and it is on the statement because
 * a settlement nobody can check is a settlement nobody trusts.
 *
 * Bottles sold before this month have already eaten the oldest invoice layers,
 * so they are consumed first — otherwise every month would value from the
 * cheapest stock again and the owner would be underpaid repeatedly.
 *
 * @param ownerId - Whose statement
 * @param outletId - Which outlet's sales
 * @param month - The month, as YYYY-MM
 * @returns One line per wine, with what is owed and what it was drawn from
 */
const adminGetStatement = adminProcedure
  .input(
    z.object({
      ownerId: z.string().uuid(),
      outletId: z.string().uuid(),
      month: z.string().regex(/^\d{4}-\d{2}$/, 'Expected a YYYY-MM month'),
    }),
  )
  .query(async ({ input }) => {
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

      Not the import price: Sophie's instruction is the landed cost from the
      Pricing Manager, which is freight and transfer inclusive, and
      `logistics_shipment_items.landed_cost_per_bottle` is where that is
      decided — `lotShipmentCost` says so in as many words, and the payout
      needs the same answer as the pricing screen or the two disagree about
      what a bottle cost.

      The owner's own shipment line wins. One wine can arrive on two owners'
      shipments at two costs, and taking the latest line anywhere once gave
      Ihab's two cases Crurated's cost for their thirty.
    */
    const costs = lwins.length
      ? await client<
          {
            key: string;
            landedPerBottle: number | null;
            shipmentNumber: string | null;
            ownLine: boolean;
          }[]
        >`
          SELECT DISTINCT ON (key)
                 ${packAgnostic(
                   () => client`UPPER(REGEXP_REPLACE(i.lwin, '[^A-Za-z0-9]', '', 'g'))`,
                 )} AS key,
                 i.landed_cost_per_bottle AS "landedPerBottle",
                 sh.shipment_number AS "shipmentNumber",
                 (sh.partner_id = ow.partner_id) IS TRUE AS "ownLine"
          FROM logistics_shipment_items i
          JOIN logistics_shipments sh ON sh.id = i.shipment_id
          CROSS JOIN (
            SELECT partner_id FROM cons_owners WHERE id = ${input.ownerId}
          ) ow
          WHERE i.lwin IS NOT NULL
            AND i.landed_cost_per_bottle IS NOT NULL
            AND ${packAgnostic(
              () => client`UPPER(REGEXP_REPLACE(i.lwin, '[^A-Za-z0-9]', '', 'g'))`,
            )} = ANY(${lwins.map((value) => wineKey(value))}::text[])
          ORDER BY key,
                   (sh.partner_id = ow.partner_id) IS TRUE DESC,
                   i.created_at DESC
        `
      : [];

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
  });

export default adminGetStatement;
