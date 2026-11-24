import { client } from '@/database/client';

import getWineAliases from './getWineAliases';
import allocateSale, { layerOrder } from '../utils/allocateSale';
import type { SaleLayer } from '../utils/allocateSale';
import applyOpeningPosition from '../utils/applyOpeningPosition';
import type { OpeningPlacement } from '../utils/applyOpeningPosition';
import canonicalWineCode from '../utils/canonicalWineCode';
import { settles } from '../utils/classifyInvoice';
import {
  codeBridgeCtes,
  codeBridgeJoins,
  confirmedLinksReady,
  resolvedSnapshotCode,
} from '../utils/codeBridge';
import matchSaleLine from '../utils/matchSaleLine';
import type { RegisterCode } from '../utils/matchSaleLine';
import openingReady from '../utils/openingReady';
import { openingBottles } from '../utils/startingLayerBottles';
import tableReady from '../utils/tableReady';
import wineKey from '../utils/wineKey';


export interface OutletSaleLine {
  outletCode: string;
  productName: string;
  bottles: number;
}

interface ArrangementRow {
  id: string;
  ownerId: string;
  kind: string;
}

const squash = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Tie a month of an outlet's sales to owners and invoice lines
 *
 * Shared by the upload and by confirming a line from the queue, so a sale is
 * attributed one way whichever door it came in by. Writes nothing: the caller
 * decides what replaces what.
 *
 * Each line is matched to the invoice lines its wine came in on
 * (`matchSaleLine`), then its bottles are split across them first in, first
 * out, oldest invoice first (`allocateSale`). A line marked "not ours" by a
 * person is City Drinks' own stock and goes there, billed and paid to nobody.
 *
 * Each invoice line starts the month with what it still holds. Where the
 * payment run's Codes tab gives an opening position (bottles left per line at
 * 30 September), lines on those invoices start from it and only later months'
 * sales come off them, because the history has to match what City Drinks was
 * actually billed and paid (Sophie, 23 Nov). Other lines start full, less every
 * earlier month's sales. Invoices of private client orders are never matched:
 * those bottles were sold to a named client, not taken into stock.
 *
 * @param input - The outlet, the month (YYYY-MM) and its lines
 * @returns Sold rows to write, and the lines still unanswered
 */
const attributeOutletSales = async (input: {
  outletId: string;
  month: string;
  lines: OutletSaleLine[];
}) => {
  const hasLinks = await confirmedLinksReady();
  const hasTypes = await tableReady('cons_invoice_types');
  const hasRegister = await tableReady('cons_outlet_codes');

  const arrangements = await client<ArrangementRow[]>`
    SELECT a.id, a.owner_id AS "ownerId",
           ${hasRegister ? client`ow.kind` : client`'partner'`} AS kind
    FROM cons_arrangements a
    JOIN cons_owners ow ON ow.id = a.owner_id
    WHERE a.outlet_id = ${input.outletId}
  `;
  const arrangementByOwner = new Map(
    arrangements.map((row) => [row.ownerId, row.id]),
  );
  const ownerOfArrangement = new Map(
    arrangements.map((row) => [row.id, row.ownerId]),
  );
  const outletOwn = arrangements.find((row) => row.kind === 'outlet-own');

  /*
    Every code the outlet has ever published beside one of ours, from the most
    recent day it appeared — not just today's feed, which no longer lists the
    wines they have sold out of.
  */
  const bridged = await client<{ outletCode: string; code: string | null }[]>`
    WITH ${codeBridgeCtes(input.outletId, hasLinks)},
    snap AS (
      SELECT DISTINCT ON (outlet_code) *
      FROM cons_snapshots
      WHERE outlet_id = ${input.outletId}
      ORDER BY outlet_code, taken_at DESC
    )
    SELECT s.outlet_code AS "outletCode", ${resolvedSnapshotCode()} AS code
    FROM snap s
    ${codeBridgeJoins()}
  `;

  const links = hasLinks
    ? await client<{ outletCode: string; lwin18: string; ownerId: string | null }[]>`
        SELECT outlet_code AS "outletCode", lwin18,
               ${hasTypes ? client`owner_id` : client`NULL::uuid`} AS "ownerId"
        FROM cons_code_links WHERE outlet_id = ${input.outletId}
      `
    : [];

  const bridge = new Map<string, string>();
  const notOurs = new Set<string>();
  /* Whose a code is, where a person said so for a wine two owners consign */
  const ownerOfCode = new Map<string, string>();

  /* A code merged into another wine reaches that wine's lines */
  const aliases = await getWineAliases(input.outletId);
  const canonical = (code: string) => canonicalWineCode(code, aliases).code ?? code;

  for (const row of bridged) {
    if (row.code) bridge.set(squash(row.outletCode), canonical(row.code));
  }

  /* A person's link is final, and reaches codes no feed ever carried */
  for (const row of links) {
    if (row.lwin18 === 'NOT-OURS') notOurs.add(squash(row.outletCode));
    else bridge.set(squash(row.outletCode), canonical(row.lwin18));

    if (row.ownerId) ownerOfCode.set(squash(row.outletCode), row.ownerId);
  }

  const layers = await client<SaleLayer[]>`
    SELECT m.id::text AS id, m.arrangement_id AS "arrangementId", m.lwin18,
           m.product_name AS "productName", m.doc_ref AS "docRef",
           m.doc_date::text AS "docDate", m.bottles::float8 AS bottles,
           ${hasTypes ? client`m.invoice_type` : client`NULL::text`} AS "invoiceType"
    FROM cons_movements m
    JOIN cons_arrangements a ON a.id = m.arrangement_id
    WHERE a.outlet_id = ${input.outletId} AND m.kind = 'out'
      -- A month's sales can only have come from wine invoiced by its last day:
      -- October's San Polo was put on INV-000524, dated 18 November
      AND m.doc_date < (${`${input.month}-01`}::date + INTERVAL '1 month')
      ${hasTypes ? client`AND m.invoice_type IS DISTINCT FROM 'pco'` : client``}
  `;

  const register: RegisterCode[] = hasRegister
    ? await client<RegisterCode[]>`
        SELECT c.outlet_code AS "outletCode", c.doc_ref AS "docRef",
               c.wine_name AS "wineName", c.owner_id AS "ownerId",
               ow.name AS "ownerName"
        FROM cons_outlet_codes c
        LEFT JOIN cons_owners ow ON ow.id = c.owner_id
        WHERE c.outlet_id = ${input.outletId}
      `
    : [];

  /*
    The opening position: bottles left per invoice line when the payment run
    was last settled. Only an opening before this month applies.
  */
  const opening = (await openingReady())
    ? await client<
        {
          outletCode: string | null;
          docRef: string | null;
          wineName: string;
          leftBottles: number;
          openingAt: string;
        }[]
      >`
        SELECT outlet_code AS "outletCode", doc_ref AS "docRef",
               wine_name AS "wineName", left_bottles::float8 AS "leftBottles",
               opening_at::text AS "openingAt"
        FROM cons_outlet_codes
        WHERE outlet_id = ${input.outletId}
          AND opening_at IS NOT NULL
          AND left_bottles IS NOT NULL
          AND opening_at < ${`${input.month}-01`}::date
      `
    : [];
  const openingAt = opening.reduce<string | null>(
    (latest, row) => (!latest || row.openingAt > latest ? row.openingAt : latest),
    null,
  );
  const placement: OpeningPlacement | null = openingAt
    ? applyOpeningPosition(
        layers.map((layer) => ({ ...layer, id: layer.id ?? '' })),
        opening
          .filter((row) => row.openingAt === openingAt)
          .map((row) => ({
            ...row,
            outletCode: row.outletCode ? squash(row.outletCode) : null,
          })),
        (code) => {
          const lwin = bridge.get(squash(code));

          return lwin ? wineKey(lwin) : null;
        },
        openingAt,
      )
    : null;

  /*
    Each of our lines keeps the opening it was given, so the statement and the
    settlement start every line exactly where this does.
  */
  if (placement) {
    /* As one JSON text: the driver cannot send an array parameter here */
    const openings = JSON.stringify(
      [...placement.available].map(([id, bottles]) => ({ id, bottles })),
    );

    await client`
      UPDATE cons_movements m SET opening_bottles = NULL
      FROM cons_arrangements a
      WHERE a.id = m.arrangement_id AND a.outlet_id = ${input.outletId}
        AND m.kind = 'out' AND m.opening_bottles IS NOT NULL
    `;
    await client`
      UPDATE cons_movements m SET opening_bottles = v.bottles
      FROM jsonb_to_recordset(${openings}::jsonb) AS v(id uuid, bottles numeric)
      WHERE m.id = v.id
    `;
  }

  /* What each invoice line holds as this month starts */
  const keyOfLayer = (layer: SaleLayer) =>
    wineKey(layer.lwin18 ?? layer.productName);
  const remaining = new Map<string, number>(
    layers.map((layer) => [
      layer.id ?? '',
      openingBottles(
        {
          opening: placement?.available.get(layer.id ?? '') ?? null,
          bottles: layer.bottles,
          docDate: layer.docDate,
        },
        openingAt,
      ),
    ]),
  );
  const fromOpening = (layer: SaleLayer) =>
    placement?.available.has(layer.id ?? '') ?? false;

  /** Take bottles off an owner's lines of one wine, oldest first */
  const drawDown = (
    candidates: SaleLayer[],
    arrangementId: string,
    bottles: number,
  ) => {
    let left = bottles;
    const ordered = candidates
      .filter((layer) => layer.arrangementId === arrangementId)
      .sort(layerOrder);

    for (const layer of ordered) {
      if (left <= 0) break;

      const id = layer.id ?? '';
      const take = Math.min(remaining.get(id) ?? 0, left);

      remaining.set(id, (remaining.get(id) ?? 0) - take);
      left -= take;
    }
  };

  /* What earlier months already drew down, per wine and per owner */
  const earlier = await client<
    {
      arrangementId: string;
      lwin18: string | null;
      productName: string;
      afterOpening: boolean;
      bottles: number;
    }[]
  >`
    SELECT m.arrangement_id AS "arrangementId", m.lwin18,
           MIN(m.product_name) AS "productName",
           ${openingAt ? client`(m.doc_date > ${openingAt}::date)` : client`TRUE`} AS "afterOpening",
           SUM(m.bottles)::float8 AS bottles
    FROM cons_movements m
    JOIN cons_arrangements a ON a.id = m.arrangement_id
    WHERE a.outlet_id = ${input.outletId}
      AND m.kind = 'sold'
      AND TO_CHAR(m.doc_date, 'YYYY-MM') < ${input.month}
    GROUP BY 1, 2, 4
  `;

  /*
    Sales up to the opening are already inside it for the lines it covers, so
    they come off the other lines only; later sales come off any line.
  */
  for (const row of earlier) {
    /* With an opening, every line it dates from already has them taken off */
    if (openingAt && !row.afterOpening) continue;

    const key = wineKey(row.lwin18 ?? row.productName);
    const candidates = layers.filter(
      (layer) =>
        keyOfLayer(layer) === key && (row.afterOpening || !fromOpening(layer)),
    );

    drawDown(candidates, row.arrangementId, row.bottles);
  }

  const sold: {
    arrangementId: string;
    lwin18: string | null;
    productName: string;
    outletCode: string;
    bottles: number;
    short: boolean;
    via: string;
  }[] = [];
  const unmatched: {
    outletCode: string;
    productName: string;
    bottles: number;
    reason: string;
    suggestedOwnerId: string | null;
    suggestedLwin18: string | null;
    suggestedName: string | null;
    suggestedWhy: string | null;
    candidateOwnerIds: string[] | null;
  }[] = [];


  for (const line of input.lines) {
    const code = squash(line.outletCode);

    if (notOurs.has(code) && outletOwn) {
      sold.push({
        arrangementId: outletOwn.id,
        lwin18: null,
        productName: line.productName,
        outletCode: line.outletCode,
        bottles: line.bottles,
        short: false,
        via: 'Marked not ours: the outlet’s own stock',
      });
      continue;
    }

    const match = matchSaleLine(line, {
      bridge,
      layers,
      register,
      arrangementByOwner,
      ownerOfArrangement,
    });

    if (!match.matched) {
      unmatched.push({
        outletCode: line.outletCode,
        productName: line.productName,
        bottles: line.bottles,
        reason: match.reason,
        suggestedOwnerId: match.suggestion?.ownerId ?? null,
        suggestedLwin18: match.suggestion?.lwin18 ?? null,
        suggestedName: match.suggestion?.productName ?? null,
        suggestedWhy: match.suggestion?.why ?? null,
        candidateOwnerIds: null,
      });
      continue;
    }

    /*
      A wine two owners both consign, and nothing says whose this sale is.
      First in, first out across them would pay whichever invoiced first for
      the other's bottles, so a person decides — unless someone already has
      (the code's owner) or the Codes tab names one. Stock the outlet owns is
      unaffected: it is drawn down first whoever's it was.
    */
    let drawable = match.layers;
    const consignors = [
      ...new Set(
        drawable
          .filter((layer) => settles(layer.invoiceType))
          .map((layer) => ownerOfArrangement.get(layer.arrangementId))
          .filter((owner): owner is string => Boolean(owner)),
      ),
    ];

    if (consignors.length > 1) {
      const chosen =
        ownerOfCode.get(code) ??
        (match.shortTo ? ownerOfArrangement.get(match.shortTo) : undefined);
      const chosenArrangement = chosen ? arrangementByOwner.get(chosen) : null;

      if (!chosenArrangement) {
        unmatched.push({
          outletCode: line.outletCode,
          productName: line.productName,
          bottles: line.bottles,
          reason:
            'More than one owner consigns this wine and nothing says whose these bottles were',
          suggestedOwnerId: null,
          suggestedLwin18: drawable[0]?.lwin18 ?? null,
          suggestedName: drawable[0]?.productName ?? null,
          suggestedWhy: 'Choose the owner',
          candidateOwnerIds: consignors,
        });
        continue;
      }

      drawable = drawable.filter(
        (layer) =>
          !settles(layer.invoiceType) ||
          layer.arrangementId === chosenArrangement,
      );
    }

    /* One wine can appear on two lines of their sheet; FIFO runs across both */
    const shares = allocateSale(
      drawable.map((layer) => ({
        ...layer,
        bottles: remaining.get(layer.id ?? '') ?? layer.bottles,
      })),
      line.bottles,
      new Map(),
      match.shortTo,
    );

    for (const share of shares) {
      /*
        From the opening on, more sold than the consignment stock left is City
        Drinks' own stock (Sophie, 24 Nov 2026): already billed, never charged.
      */
      const ownStock = share.short && openingAt !== null && outletOwn;

      if (!share.short) drawDown(drawable, share.arrangementId, share.bottles);
      sold.push({
        arrangementId: ownStock ? outletOwn.id : share.arrangementId,
        lwin18: share.lwin18,
        productName: share.productName || line.productName,
        outletCode: line.outletCode,
        bottles: share.bottles,
        short: ownStock ? false : share.short,
        via: ownStock
          ? 'More sold than the consignment stock left: City Drinks’ own stock'
          : match.via,
      });
    }
  }

  return {
    sold,
    unmatched,
    opening: placement
      ? {
          openingAt,
          invoices: placement.coveredDocs.size,
          unplaced: placement.unplaced,
        }
      : null,
  };
};

export default attributeOutletSales;
