import isCraftCultureOwner from '@/app/_wms/utils/isCraftCultureOwner';
import { client } from '@/database/client';

import buildOwnerStatement from './buildOwnerStatement';
import checkSettlementPrices from '../utils/checkSettlementPrices';
import type { PricedLine } from '../utils/checkSettlementPrices';
import paidOnReady from '../utils/paidOnReady';
import tableReady from '../utils/tableReady';
import unmatchedReady from '../utils/unmatchedReady';
import wineKey from '../utils/wineKey';

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Owners a City Drinks sale pays nothing to */
const owedToNobodyOnSale = (owner: { kind: string | null; name: string; paidOn: string }) =>
  owner.kind === 'outlet-own' ||
  isCraftCultureOwner(owner.name) ||
  owner.paidOn === 'dispatch';

export interface SettlementCdLine {
  outletCode: string | null;
  productName: string;
  ownerName: string;
  bottles: number;
  docRef: string | null;
  pricePerBottle: number;
  priceCutPct: number | null;
  amount: number;
}

export interface SettlementAlreadyBilled {
  outletCode: string | null;
  productName: string;
  ownerName: string;
  bottles: number;
  docRef: string | null;
  pricePerBottle: number;
  value: number;
}

export interface SettlementPayoutLine {
  productName: string;
  outletCode: string | null;
  bottles: number;
  costPerBottle: number | null;
  amount: number | null;
  costFrom: string | null;
  billed: number;
}

export interface SettlementOwner {
  ownerId: string;
  ownerName: string;
  partnerId: string | null;
  lines: SettlementPayoutLine[];
  adjustments: number;
  bottles: number;
  dueToOwner: number;
  billedToOutlet: number;
  margin: number;
  withoutCost: number;
}

export interface SettlementException {
  kind: 'unmatched' | 'oversold' | 'no-cost' | 'count' | 'price';
  outletCode: string | null;
  productName: string;
  bottles: number;
  detail: string;
}

/**
 * One month with an outlet, settled: what they owe us, what we owe each owner,
 * and whether every bottle on their report is accounted for
 *
 * Built from the same per-owner statements the owner screens show, so the
 * month and its owners cannot disagree. It adds what only the month knows: the
 * adjustments log, the bottles already billed (drawn from stock City Drinks
 * bought, so never charged again), the lines still waiting for a wine, and
 * the check Sophie asked for, that the report's bottles equal billed plus
 * already billed plus exceptions. A month that does not add up says so before
 * anything is exported or approved.
 *
 * @example
 *   const month = await buildMonthSettlement({ outletId, month: '2026-10' });
 *   month.totals.totalDue; // 46660.49
 *
 * @param input - The outlet and the month (YYYY-MM)
 * @returns The CD statement, owner payouts, margin, exceptions and the check
 */
const buildMonthSettlement = async (input: {
  outletId: string;
  month: string;
}) => {
  const hasPaidOn = await paidOnReady();
  const owners = await client<
    {
      id: string;
      name: string;
      kind: string | null;
      partnerId: string | null;
      paidOn: string;
    }[]
  >`
    SELECT DISTINCT ow.id, ow.name, ow.kind, ow.partner_id AS "partnerId",
           ${hasPaidOn ? client`ow.consignment_paid_on` : client`'sale'::text`} AS "paidOn"
    FROM cons_arrangements a
    JOIN cons_owners ow ON ow.id = a.owner_id
    WHERE a.outlet_id = ${input.outletId} AND a.is_active
    ORDER BY ow.name
  `;

  const statements = await Promise.all(
    owners.map(async (owner) => ({
      owner,
      statement: await buildOwnerStatement({
        ownerId: owner.id,
        outletId: input.outletId,
        month: input.month,
      }),
    })),
  );

  const hasSettlement = await tableReady('cons_adjustments');

  const adjustments = hasSettlement
    ? await client<
        {
          id: string;
          description: string;
          amount: number;
          ownerId: string | null;
          ownerAmount: number | null;
          createdAt: string;
        }[]
      >`
        SELECT id, description, amount::float8 AS amount, owner_id AS "ownerId",
               owner_amount::float8 AS "ownerAmount", created_at::text AS "createdAt"
        FROM cons_adjustments
        WHERE outlet_id = ${input.outletId} AND month = ${input.month}
        ORDER BY created_at
      `
    : [];

  const unmatched = (await unmatchedReady())
    ? await client<
        { outletCode: string | null; productName: string; bottles: number; reason: string | null }[]
      >`
        SELECT outlet_code AS "outletCode", product_name AS "productName",
               bottles::float8 AS bottles, reason
        FROM cons_import_unmatched
        WHERE outlet_id = ${input.outletId} AND month = ${input.month}
        ORDER BY bottles DESC
      `
    : [];

  const [report] = hasSettlement
    ? await client<
        { declaredBottles: number | null; readBottles: number; lines: number; uploadedAt: string }[]
      >`
        SELECT declared_bottles::float8 AS "declaredBottles",
               read_bottles::float8 AS "readBottles", lines,
               uploaded_at::text AS "uploadedAt"
        FROM cons_month_reports
        WHERE outlet_id = ${input.outletId} AND month = ${input.month}
      `
    : [];

  const [closed] = hasSettlement
    ? await client<
        {
          approvedAt: string;
          approvedBy: string | null;
          zohoInvoiceNumber: string | null;
          zohoBills: unknown;
        }[]
      >`
        SELECT c.approved_at::text AS "approvedAt", u.name AS "approvedBy",
               c.zoho_invoice_number AS "zohoInvoiceNumber", c.zoho_bills AS "zohoBills"
        FROM cons_month_closes c
        LEFT JOIN users u ON u.id = c.approved_by
        WHERE c.outlet_id = ${input.outletId} AND c.month = ${input.month}
      `
    : [];

  /* Dated cuts to City Drinks' price in force this month, for the page */
  const priceCuts = (await tableReady('cons_price_cuts'))
    ? await client<{ wineKey: string; label: string | null; pctOff: number; validFrom: string }[]>`
        SELECT wine_key AS "wineKey", label, pct_off::float8 AS "pctOff",
               valid_from::text AS "validFrom"
        FROM cons_price_cuts
        WHERE outlet_id = ${input.outletId}
          AND valid_from < (${`${input.month}-01`}::date + INTERVAL '1 month')
        ORDER BY valid_from, label
      `
    : [];

  /*
    What City Drinks were billed for each wine in the three months before this
    one, latest first, for the price check (Sophie, 20 Nov 2026).
  */
  const recentPrices = await client<
    { lwin18: string | null; productName: string; docRef: string | null; docDate: string; perBottle: number }[]
  >`
    SELECT m.lwin18, m.product_name AS "productName", m.doc_ref AS "docRef",
           m.doc_date::text AS "docDate",
           (m.unit_price / COALESCE(NULLIF(m.pack, 0), 1))::float8 AS "perBottle"
    FROM cons_movements m
    JOIN cons_arrangements a ON a.id = m.arrangement_id
    WHERE a.outlet_id = ${input.outletId}
      AND m.kind = 'out'
      AND m.unit_price IS NOT NULL
      -- A private client order's price is the client's, not City Drinks'
      ${(await tableReady('cons_invoice_types')) ? client`AND m.invoice_type IS DISTINCT FROM 'pco'` : client``}
      AND m.doc_date >= (${`${input.month}-01`}::date - INTERVAL '3 months')
      AND m.doc_date < ${`${input.month}-01`}::date
    ORDER BY m.doc_date DESC, m.doc_ref DESC
  `;

  /* Per billed line: its wine, its undiscounted price, and what the owner is paid */
  const priced: PricedLine[] = [];

  const cdLines: SettlementCdLine[] = [];
  const alreadyBilled: SettlementAlreadyBilled[] = [];
  const exceptions: SettlementException[] = [];
  const payouts: SettlementOwner[] = [];
  let reportedBottles = 0;
  let shortBottles = 0;

  for (const { owner, statement } of statements) {
    const ownLines: SettlementPayoutLine[] = [];

    for (const line of statement.lines) {
      reportedBottles += line.bottlesSold;

      for (const draw of line.drawnFrom) {
        if (draw.settles) {
          const keep = line.priceCutPct ? 1 - line.priceCutPct / 100 : 1;

          priced.push({
            key: wineKey(line.lwin18 || line.productName),
            outletCode: line.outletCode,
            productName: line.productName,
            ownerName: owner.name,
            docRef: draw.docRef,
            pricePerBottle: keep > 0 ? draw.pricePerBottle / keep : draw.pricePerBottle,
            ownerCostPerBottle: line.costPerBottle,
            // C&C's own wine too: billed below its cost is a loss (Cristal Rosé 2008, Mouton 1993)
            payOwner: owner.kind !== 'outlet-own',
          });
          cdLines.push({
            outletCode: line.outletCode,
            productName: line.productName,
            ownerName: owner.name,
            bottles: draw.bottles,
            docRef: draw.docRef,
            pricePerBottle: round2(draw.pricePerBottle),
            priceCutPct: line.priceCutPct,
            amount: round2(draw.value),
          });
        } else {
          alreadyBilled.push({
            outletCode: line.outletCode,
            productName: line.productName,
            ownerName: owner.name,
            bottles: draw.bottles,
            docRef: draw.docRef,
            pricePerBottle: round2(draw.pricePerBottle),
            value: round2(draw.bottles * draw.pricePerBottle),
          });
        }
      }

      if (line.shortBottles > 0) {
        shortBottles += line.shortBottles;
        exceptions.push({
          kind: 'oversold',
          outletCode: line.outletCode,
          productName: line.productName,
          bottles: line.shortBottles,
          detail: `${line.shortBottles} sold with no invoice left to bill them against (${owner.name})`,
        });
      }

      if (owedToNobodyOnSale(owner)) continue;

      const owedBottles =
        line.bottlesSold - line.unsettledBottles - line.shortBottles;

      if (owedBottles <= 0) continue;

      if (line.dueToOwner === null) {
        exceptions.push({
          kind: 'no-cost',
          outletCode: line.outletCode,
          productName: line.productName,
          bottles: owedBottles,
          detail: `${owner.name}: no cost in the Pricing Manager, so nothing can be owed yet`,
        });
      }

      ownLines.push({
        productName: line.productName,
        outletCode: line.outletCode,
        bottles: owedBottles,
        costPerBottle:
          line.costPerBottle === null ? null : round2(line.costPerBottle),
        amount: line.dueToOwner === null ? null : round2(line.dueToOwner),
        costFrom: line.costFrom,
        billed: round2(line.billedToOutlet),
      });
    }

    /*
      City Drinks' own stock and C&C's own wine are owed to nobody, and an
      owner paid on dispatch was owed when the invoice went out (Partner
      statements), so nothing more on the sale.
    */
    if (owedToNobodyOnSale(owner)) continue;

    const ownAdjustments = adjustments
      .filter((row) => row.ownerId === owner.id && row.ownerAmount)
      .reduce((sum, row) => sum + (row.ownerAmount ?? 0), 0);

    if (ownLines.length === 0 && ownAdjustments === 0) continue;

    const due = ownLines.reduce((sum, row) => sum + (row.amount ?? 0), 0);
    const billed = ownLines.reduce((sum, row) => sum + row.billed, 0);

    payouts.push({
      ownerId: owner.id,
      ownerName: owner.name,
      partnerId: owner.partnerId,
      lines: ownLines.sort((a, b) => b.bottles - a.bottles),
      adjustments: round2(ownAdjustments),
      bottles: ownLines.reduce((sum, row) => sum + row.bottles, 0),
      dueToOwner: round2(due + ownAdjustments),
      billedToOutlet: round2(billed),
      margin: round2(billed - due - ownAdjustments),
      withoutCost: ownLines.filter((row) => row.amount === null).length,
    });
  }

  for (const flag of checkSettlementPrices(priced, recentPrices)) {
    exceptions.push({
      kind: 'price',
      outletCode: flag.outletCode,
      productName: flag.productName,
      bottles: 0,
      detail: flag.detail,
    });
  }

  for (const line of unmatched) {
    exceptions.push({
      kind: 'unmatched',
      outletCode: line.outletCode,
      productName: line.productName,
      bottles: line.bottles,
      detail: line.reason ?? 'Not matched to a wine of ours',
    });
  }

  const billedBottles = cdLines.reduce((sum, row) => sum + row.bottles, 0);
  const alreadyBilledBottles = alreadyBilled.reduce(
    (sum, row) => sum + row.bottles,
    0,
  );
  const unmatchedBottles = unmatched.reduce((sum, row) => sum + row.bottles, 0);
  const salesDue = round2(cdLines.reduce((sum, row) => sum + row.amount, 0));
  const adjustmentsTotal = round2(
    adjustments.reduce((sum, row) => sum + row.amount, 0),
  );
  const dueToOwners = round2(
    payouts.reduce((sum, row) => sum + row.dueToOwner, 0),
  );

  /*
    Every bottle on the report has to land somewhere: billed now, already
    billed, or an exception. The report's own total is the yardstick where it
    stated one; otherwise what was read from it.
  */
  const onReport =
    report?.declaredBottles ?? report?.readBottles ?? reportedBottles + unmatchedBottles;
  const accountedFor =
    billedBottles + alreadyBilledBottles + shortBottles + unmatchedBottles;
  const addsUp = Math.abs(onReport - accountedFor) < 0.001;

  if (!addsUp) {
    exceptions.push({
      kind: 'count',
      outletCode: null,
      productName: 'Bottle check',
      bottles: onReport - accountedFor,
      detail: `${onReport} bottles on the report, ${accountedFor} accounted for (${billedBottles} billed, ${alreadyBilledBottles} already billed, ${shortBottles} oversold, ${unmatchedBottles} unmatched)`,
    });
  }

  /* What stops a month being approved: every one must be answered first */
  const blockers = [
    ...(unmatchedBottles > 0
      ? [`${unmatched.length} unmatched codes (${unmatchedBottles} bottles) to map`]
      : []),
    ...(exceptions.some((row) => row.kind === 'no-cost')
      ? [
          `${exceptions.filter((row) => row.kind === 'no-cost').length} wines with no cost in the Pricing Manager`,
        ]
      : []),
    ...(!addsUp ? ['The bottles on the report do not add up'] : []),
    ...(!report && reportedBottles === 0 ? ['No report uploaded for this month'] : []),
  ];

  return {
    month: input.month,
    closed: closed ?? null,
    report: report ?? null,
    cdLines: cdLines.sort(
      (a, b) =>
        (a.ownerName ?? '').localeCompare(b.ownerName ?? '') ||
        b.amount - a.amount,
    ),
    alreadyBilled,
    adjustments,
    priceCuts,
    payouts,
    exceptions,
    check: {
      onReport,
      billedBottles,
      alreadyBilledBottles,
      shortBottles,
      unmatchedBottles,
      accountedFor,
      addsUp,
    },
    totals: {
      salesDue,
      adjustments: adjustmentsTotal,
      totalDue: round2(salesDue + adjustmentsTotal),
      alreadyBilledValue: round2(
        alreadyBilled.reduce((sum, row) => sum + row.value, 0),
      ),
      dueToOwners,
      margin: round2(salesDue - dueToOwners),
    },
    blockers,
  };
};

export default buildMonthSettlement;
