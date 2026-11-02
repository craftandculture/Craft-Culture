import { client } from '@/database/client';

import getPricingManagerLanded from './getPricingManagerLanded';
import { settles } from '../utils/classifyInvoice';
import tableReady from '../utils/tableReady';
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
  /** The currency costPerBottle and dueToOwner are stated in */
  costCurrency: 'AED' | 'USD';
  /** Bottles that sold with no invoice layer left to draw from */
  shortBottles: number;
  /** Drawn from the outlet's own prepaid or outright stock: billed and paid to nobody */
  unsettledBottles: number;
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
  invoiceType: string | null;
}

/** The UAE dirham's fixed peg to the US dollar */
const AED_PER_USD = 3.6725;

/*
  One wine is one line whatever pack it was invoiced or sold in. Keyed exactly,
  a wine sold under its 3-pack code and invoiced in sixes found no invoice
  layer — the "no invoice left to bill them against" bottles.
*/
const keyOf = (lwin18: string | null | undefined, name?: string | null) =>
  wineKey(lwin18 || name);

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

    const hasTypes = await tableReady('cons_invoice_types');

    const soldRows = await client<SoldRow[]>`
      SELECT m.lwin18, MIN(m.product_name) AS "productName",
             MIN(m.outlet_code) AS "outletCode",
             SUM(m.bottles)::float8 AS bottles
      FROM cons_movements m
      WHERE m.arrangement_id = ${arrangement.id}
        AND m.kind = 'sold'
        AND TO_CHAR(m.doc_date, 'YYYY-MM') = ${input.month}
      GROUP BY m.lwin18
    `;

    const soldByKey = new Map<string, SoldRow>();

    for (const row of soldRows) {
      const key = keyOf(row.lwin18, row.productName);
      const existing = soldByKey.get(key);

      soldByKey.set(key, {
        lwin18: existing?.lwin18 ?? row.lwin18,
        productName: existing?.productName ?? row.productName,
        outletCode: existing?.outletCode ?? row.outletCode,
        bottles: (existing?.bottles ?? 0) + row.bottles,
      });
    }

    const sold = [...soldByKey.values()].filter((row) => row.bottles > 0);

    if (sold.length === 0) {
      return { lines: [], summary: null, arrangement };
    }

    const layers = await client<LayerRow[]>`
      SELECT m.lwin18, m.product_name AS "productName",
             m.doc_date::text AS "docDate", m.doc_ref AS "docRef",
             m.bottles::float8 AS bottles, m.unit_price AS "unitPrice",
             m.pack, m.currency,
             ${hasTypes ? client`m.invoice_type` : client`NULL::text`} AS "invoiceType"
      FROM cons_movements m
      WHERE m.arrangement_id = ${arrangement.id} AND m.kind = 'out'
      ORDER BY m.doc_date, m.doc_ref
    `;

    /*
      Bottles this owner sold at this outlet in earlier months. Those layers are
      spent, so this month starts where the last one finished.
    */
    const earlier = await client<
      { lwin18: string | null; productName: string; bottles: number }[]
    >`
      SELECT m.lwin18, MIN(m.product_name) AS "productName",
             SUM(m.bottles)::float8 AS bottles
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
    const [owner] = await client<{ partnerId: string | null }[]>`
      SELECT partner_id AS "partnerId" FROM cons_owners WHERE id = ${input.ownerId}
    `;
    const live = await getPricingManagerLanded(keys, {
      shipmentFallback: true,
      partnerId: owner?.partnerId ?? null,
    });

    /*
      Reading a statement writes nothing. The live cost is written down by the
      daily cron (rememberLandedCosts) while the wine is still on the Pricing
      Manager, which is what keeps a sold-out wine's past month priceable.
    */

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
      The partner's own price sheet, where they have one: Crurated's recon
      workbook and Cru's price list. Their price is what they are owed; the
      Pricing Manager is our cost model and, for them, has no import price.
      A dated cut (Crurated's 10% on four wines from 9 Oct 2026) applies to
      any month it falls in.
    */
    const monthEnd = `${input.month}-28`;
    const hasSheets = await tableReady('cons_owner_costs');
    const sheet = hasSheets && keys.length
      ? await client<
          { key: string; costPerBottle: number; tab: string | null; pctOff: number | null }[]
        >`
          SELECT DISTINCT ON (c.wine_key)
                 c.wine_key AS key, c.cost_per_bottle::float8 AS "costPerBottle",
                 c.tab,
                 (
                   SELECT MAX(j.pct_off)::float8
                   FROM cons_cost_adjustments j
                   WHERE j.owner_id = c.owner_id
                     AND UPPER(j.w_code) = UPPER(c.w_code)
                     AND j.valid_from <= (DATE_TRUNC('month', ${monthEnd}::date)
                                          + INTERVAL '1 month - 1 day')
                 ) AS "pctOff"
          FROM cons_owner_costs c
          WHERE c.owner_id = ${input.ownerId}
            AND c.wine_key = ANY(${keys}::text[])
          ORDER BY c.wine_key, c.created_at DESC
        `
      : [];

    /*
      Set by hand wins outright: somebody has looked. Then the partner's own
      sheet, then the Pricing Manager, then the last figure it gave.
    */
    const costs = keys.map((key) => {
      const kept = remembered.find((row) => row.key === key);
      const listed = sheet.find((row) => row.key === key);
      const now = live.find((row) => row.key === key);

      if (kept?.source === 'by-hand') {
        return {
          key,
          landedPerBottle: kept.landedPerBottle,
          shipmentNumber: 'Set by hand',
          ownLine: true,
        };
      }

      if (listed) {
        const cut = listed.pctOff ? 1 - listed.pctOff / 100 : 1;

        return {
          key,
          landedPerBottle: Math.round(listed.costPerBottle * cut * 100) / 100,
          shipmentNumber: `${listed.tab ?? 'Partner price sheet'}${
            listed.pctOff ? `, less ${listed.pctOff}%` : ''
          }`,
          ownLine: true,
        };
      }

      const chosen = now ?? kept ?? null;

      return {
        key,
        landedPerBottle: chosen?.landedPerBottle ?? null,
        shipmentNumber:
          chosen === null
            ? null
            : chosen === now
              ? now.from
              : `last known (${kept?.source ?? 'kept'})`,
        ownLine: true,
      };
    });

    const costByLwin = new Map(costs.map((row) => [row.key, row]));
    const consumedByLwin = new Map<string, number>();

    for (const row of earlier) {
      const key = keyOf(row.lwin18, row.productName);

      consumedByLwin.set(key, (consumedByLwin.get(key) ?? 0) + row.bottles);
    }

    const lines: StatementLine[] = sold.map((row) => {
      const key = keyOf(row.lwin18, row.productName);

      /*
        The price per BOTTLE. Our invoice states a rate against the unit sold,
        so a 3-pack at 1,698 is 566 a bottle — dividing by the pack is the
        difference between a right and a threefold-wrong settlement.
      */
      const outLayers: OutLayer[] = layers
        .filter((layer) => keyOf(layer.lwin18, layer.productName) === key)
        .map((layer) => ({
          docDate: layer.docDate,
          docRef: layer.docRef,
          bottles: layer.bottles,
          pricePerBottle:
            layer.unitPrice && layer.pack && layer.pack > 0
              ? layer.unitPrice / layer.pack
              : (layer.unitPrice ?? 0),
          currency: layer.currency,
          settles: settles(layer.invoiceType),
        }));

      const valued = valueFifo(
        outLayers,
        row.bottles,
        consumedByLwin.get(key) ?? 0,
      );

      const costed = costByLwin.get(wineKey(row.lwin18));
      /*
        Landed cost is held in USD (the Pricing Manager's currency); the
        outlet is billed in the invoice's currency. Subtracting one from the
        other gave a margin in no currency at all, so a cost is stated in the
        billing currency: AED at the fixed peg. Any other billing currency is
        left as it was and the line says so through costCurrency.
      */
      const landedUsd = costed?.landedPerBottle ?? null;
      const inAed = valued.currency === 'AED';
      const costPerBottle =
        landedUsd === null ? null : inAed ? landedUsd * AED_PER_USD : landedUsd;
      /* Bottles of the outlet's own stock are owed to nobody */
      const owedBottles = row.bottles - valued.unsettledBottles;

      return {
        lwin18: row.lwin18,
        productName: row.productName,
        outletCode: row.outletCode,
        bottlesSold: row.bottles,
        costPerBottle,
        /** Never zero where the cost is unknown — that is a silent write-off */
        dueToOwner:
          owedBottles <= 0
            ? 0
            : costPerBottle === null
              ? null
              : costPerBottle * owedBottles,
        /** The shipment the landed cost came from, so a figure can be traced */
        costFrom: costed?.shipmentNumber ?? null,
        /** False where the cost came from another owner's shipment line */
        costIsOwnLine: costed?.ownLine ?? false,
        billedToOutlet: valued.value,
        currency: valued.currency,
        costCurrency: inAed ? 'AED' : 'USD',
        shortBottles: valued.shortBottles,
        unsettledBottles: valued.unsettledBottles,
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
        unsettledBottles: totals.unsettledBottles + line.unsettledBottles,
      }),
      {
        wines: 0,
        bottles: 0,
        dueToOwner: 0,
        billedToOutlet: 0,
        withoutCost: 0,
        shortBottles: 0,
        unsettledBottles: 0,
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
