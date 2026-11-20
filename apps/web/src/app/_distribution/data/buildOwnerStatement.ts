import { client } from '@/database/client';

import getPartnerPayoutCost from './getPartnerPayoutCost';
import type { PartnerPayoutCost } from './getPartnerPayoutCost';
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
  /** A dated cut to the price City Drinks pay, as a percentage, if one applies */
  priceCutPct: number | null;
  /** Which of our invoices the value came from */
  drawnFrom: {
    docRef: string | null;
    bottles: number;
    value: number;
    pricePerBottle: number;
    settles: boolean;
  }[];
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
    const settlementReady = await tableReady('cons_price_cuts');
    const [owner] = await client<
      {
        partnerId: string | null;
        kind: string | null;
        payoutRule: string | null;
        sharePct: number | null;
        recoveryPer75: number | null;
        recoveryFrom: string | null;
      }[]
    >`
      SELECT partner_id AS "partnerId", kind,
             ${settlementReady ? client`payout_rule` : client`'landed'::text`} AS "payoutRule",
             ${settlementReady ? client`payout_share_pct::float8` : client`NULL::float8`} AS "sharePct",
             ${settlementReady ? client`freight_recovery_per_75cl::float8` : client`NULL::float8`} AS "recoveryPer75",
             ${settlementReady ? client`freight_recovery_from::text` : client`NULL::text`} AS "recoveryFrom"
      FROM cons_owners WHERE id = ${input.ownerId}
    `;
    /* City Drinks' own stock: bought and paid for, so owed to nobody */
    const owedToNobody = owner?.kind === 'outlet-own';
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
      Sophie's rule (19 Nov 2026): a partner is paid the Pricing Manager's
      import + logistics + override on their own lot, nothing from a separate
      price sheet. So fixing what a partner is owed is always done in one
      place. A figure set by hand on the statement still wins, and a wine the
      Pricing Manager no longer holds falls back to its last known figure.
    */
    /*
      The other codes each wine answers to for this owner: the W-code and the
      LWIN a partner's price sheet paired, and codes merged on this page.
    */
    const aliases = new Map<string, Set<string>>();
    const squashCode = (value: string | null | undefined) =>
      (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (keys.length && (await tableReady('cons_owner_costs'))) {
      const pairs = await client<
        { wineKey: string | null; lwin18: string | null; wCode: string | null }[]
      >`
        SELECT DISTINCT wine_key AS "wineKey", lwin18, w_code AS "wCode"
        FROM cons_owner_costs
        WHERE owner_id = ${input.ownerId}
      `;

      for (const pair of pairs) {
        const codes = [
          squashCode(pair.wineKey),
          pair.lwin18 ? wineKey(pair.lwin18) : '',
          squashCode(pair.wCode),
        ].filter(Boolean);

        for (const code of codes) {
          if (!keys.includes(code)) continue;

          const set = aliases.get(code) ?? new Set<string>();

          codes.filter((other) => other !== code).forEach((other) => set.add(other));
          aliases.set(code, set);
        }
      }
    }

    const payout = owner?.partnerId
      ? await getPartnerPayoutCost(owner.partnerId, keys, aliases)
      : new Map<string, PartnerPayoutCost>();

    const sheetCodes = [
      ...new Set([...keys, ...[...aliases.values()].flatMap((set) => [...set])]),
    ];
    const sheet =
      sheetCodes.length && (await tableReady('cons_owner_costs'))
        ? await client<{ key: string; costPerBottle: number; tab: string | null }[]>`
            SELECT DISTINCT ON (k.key) k.key, c.cost_per_bottle::float8 AS "costPerBottle", c.tab
            FROM cons_owner_costs c
            CROSS JOIN LATERAL (
              SELECT UNNEST(ARRAY[
                UPPER(REGEXP_REPLACE(COALESCE(c.wine_key, ''), '[^A-Za-z0-9]', '', 'g')),
                UPPER(REGEXP_REPLACE(COALESCE(c.w_code, ''), '[^A-Za-z0-9]', '', 'g'))
              ]) AS key
            ) k
            WHERE c.owner_id = ${input.ownerId}
              AND k.key = ANY(${sheetCodes}::text[])
            ORDER BY k.key, c.created_at DESC
          `
        : [];

    const costs = keys.map((key) => {
      const kept = remembered.find((row) => row.key === key);
      const lot = payout.get(key);
      const now = live.find((row) => row.key === key);

      if (kept?.source === 'by-hand') {
        return {
          key,
          landedPerBottle: kept.landedPerBottle,
          shipmentNumber: 'Set by hand',
          ownLine: true,
        };
      }

      if (lot) {
        return {
          key,
          landedPerBottle: lot.perBottle,
          shipmentNumber: lot.from,
          ownLine: true,
        };
      }

      const chosen = now ?? kept ?? null;

      /*
        A wine that sold out before the Pricing Manager ever held a cost for it
        (L'If, Leflaive Sigma, Heitz Arvelets, Marsannay 2022) has only the
        partner's own price sheet. Used last, and said so on the line.
      */
      if (!chosen) {
        const listed = sheet.find(
          (row) => row.key === key || aliases.get(key)?.has(row.key),
        );

        if (listed) {
          return {
            key,
            landedPerBottle: listed.costPerBottle,
            shipmentNumber: `${listed.tab ?? 'Partner price sheet'} (no Pricing Manager cost)`,
            ownLine: true,
          };
        }
      }

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

    /*
      A dated cut to what City Drinks pay (10% from 9 Oct 2026 on four
      Crurated wines). It comes off the invoice price for any month it has
      started in; the owner's side already carries it in the Pricing Manager.
    */
    const monthLast = `${input.month}-01`;
    /* A lot's own W-code is another name for its wine, for cuts keyed on it */
    for (const [key, lot] of payout) {
      const set = aliases.get(key) ?? new Set<string>();

      lot.codes.forEach((code) => set.add(code));
      aliases.set(key, set);
    }

    const allCodes = [
      ...new Set([...keys, ...[...aliases.values()].flatMap((set) => [...set])]),
    ];
    const cuts = settlementReady && keys.length
      ? await client<{ key: string; pctOff: number }[]>`
          SELECT wine_key AS key, MAX(pct_off)::float8 AS "pctOff"
          FROM cons_price_cuts
          WHERE outlet_id = ${input.outletId}
            AND UPPER(REGEXP_REPLACE(wine_key, '[^A-Za-z0-9]', '', 'g')) = ANY(${allCodes}::text[])
            AND valid_from < (${monthLast}::date + INTERVAL '1 month')
          GROUP BY wine_key
        `
      : [];
    const cutByKey = new Map<string, number>();

    for (const cut of cuts) {
      const code = squashCode(cut.key);

      for (const key of keys) {
        if (key === code || aliases.get(key)?.has(code)) {
          cutByKey.set(key, Math.max(cutByKey.get(key) ?? 0, cut.pctOff));
        }
      }
    }

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

      const fifo = valueFifo(
        outLayers,
        row.bottles,
        consumedByLwin.get(key) ?? 0,
      );
      const cutPct = cutByKey.get(key) ?? null;
      const keep = cutPct ? 1 - cutPct / 100 : 1;
      const valued = cutPct
        ? {
            ...fifo,
            value: fifo.value * keep,
            drawnFrom: fifo.drawnFrom.map((draw) => ({
              ...draw,
              value: draw.value * keep,
              pricePerBottle: draw.pricePerBottle * keep,
            })),
          }
        : fifo;

      const costed = costByLwin.get(wineKey(row.lwin18));
      /*
        Landed cost is held in USD (the Pricing Manager's currency); the
        outlet is billed in the invoice's currency. Subtracting one from the
        other gave a margin in no currency at all, so a cost is stated in the
        billing currency: AED at the fixed peg. Any other billing currency is
        left as it was and the line says so through costCurrency.
      */
      /*
        Alain's agreed basis (Sophie, 19 Nov 2026): a share of what City
        Drinks pay for the bottle, less freight recovered per 75cl once his
        first settlement has been made. Import prices play no part in it.
      */
      const shareRule =
        owner?.payoutRule === 'invoice_share' && owner.sharePct != null;
      const billedPerBottle =
        valued.bottles - valued.unsettledBottles > 0
          ? valued.value / (valued.bottles - valued.unsettledBottles)
          : 0;
      const sizeMl = Number((row.lwin18 ?? '').replace(/\D/g, '').slice(-5)) || 750;
      const recovery =
        shareRule &&
        owner?.recoveryPer75 &&
        owner.recoveryFrom &&
        `${input.month}-01` >= owner.recoveryFrom.slice(0, 7) + '-01'
          ? owner.recoveryPer75 * (sizeMl / 750)
          : 0;
      const landedUsd = shareRule
        ? Math.max(0, billedPerBottle * (owner!.sharePct! / 100) - recovery)
        : (costed?.landedPerBottle ?? null);
      const inAed = valued.currency === 'AED';
      const costPerBottle =
        landedUsd === null
          ? null
          : inAed && !shareRule
            ? landedUsd * AED_PER_USD
            : landedUsd;
      /* Bottles of the outlet's own stock are owed to nobody */
      const owedBottles = owedToNobody
        ? 0
        : row.bottles - valued.unsettledBottles - valued.shortBottles;

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
        costFrom: shareRule
          ? `${owner!.sharePct}% of the invoice price${recovery ? `, less $${recovery.toFixed(2)} freight` : ''}`
          : (costed?.shipmentNumber ?? null),
        /** False where the cost came from another owner's shipment line */
        costIsOwnLine: costed?.ownLine ?? false,
        billedToOutlet: valued.value,
        currency: valued.currency,
        costCurrency: inAed ? 'AED' : 'USD',
        shortBottles: valued.shortBottles,
        unsettledBottles: valued.unsettledBottles,
        priceCutPct: cutPct,
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
