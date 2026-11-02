import { client } from '@/database/client';

import allocateSale from '../utils/allocateSale';
import type { SaleLayer } from '../utils/allocateSale';
import { settles } from '../utils/classifyInvoice';
import {
  codeBridgeCtes,
  codeBridgeJoins,
  confirmedLinksReady,
  resolvedSnapshotCode,
} from '../utils/codeBridge';
import matchSaleLine from '../utils/matchSaleLine';
import type { RegisterCode } from '../utils/matchSaleLine';
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
 * out, the outlet's own stock first (`allocateSale`). A line marked "not ours"
 * by a person is City Drinks' own stock and goes there, billed and paid to
 * nobody.
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

  for (const row of bridged) {
    if (row.code) bridge.set(squash(row.outletCode), row.code);
  }

  /* A person's link is final, and reaches codes no feed ever carried */
  for (const row of links) {
    if (row.lwin18 === 'NOT-OURS') notOurs.add(squash(row.outletCode));
    else bridge.set(squash(row.outletCode), row.lwin18);

    if (row.ownerId) ownerOfCode.set(squash(row.outletCode), row.ownerId);
  }

  const layers = await client<SaleLayer[]>`
    SELECT m.arrangement_id AS "arrangementId", m.lwin18,
           m.product_name AS "productName", m.doc_ref AS "docRef",
           m.doc_date::text AS "docDate", m.bottles::float8 AS bottles,
           ${hasTypes ? client`m.invoice_type` : client`NULL::text`} AS "invoiceType"
    FROM cons_movements m
    JOIN cons_arrangements a ON a.id = m.arrangement_id
    WHERE a.outlet_id = ${input.outletId} AND m.kind = 'out'
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

  /* What earlier months already drew down, per wine and per owner */
  const earlier = await client<
    { arrangementId: string; lwin18: string | null; productName: string; bottles: number }[]
  >`
    SELECT m.arrangement_id AS "arrangementId", m.lwin18,
           MIN(m.product_name) AS "productName",
           SUM(m.bottles)::float8 AS bottles
    FROM cons_movements m
    JOIN cons_arrangements a ON a.id = m.arrangement_id
    WHERE a.outlet_id = ${input.outletId}
      AND m.kind = 'sold'
      AND TO_CHAR(m.doc_date, 'YYYY-MM') < ${input.month}
    GROUP BY m.arrangement_id, m.lwin18
  `;
  /* wine key → arrangement → bottles; this month's lines are added as read */
  const drawn = new Map<string, Map<string, number>>();
  const addDrawn = (key: string, arrangementId: string, bottles: number) => {
    const byArrangement = drawn.get(key) ?? new Map<string, number>();

    byArrangement.set(
      arrangementId,
      (byArrangement.get(arrangementId) ?? 0) + bottles,
    );
    drawn.set(key, byArrangement);
  };

  for (const row of earlier) {
    addDrawn(wineKey(row.lwin18 ?? row.productName), row.arrangementId, row.bottles);
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

    const first = drawable[0];
    const key = wineKey(first?.lwin18 ?? first?.productName ?? code);
    /* One wine can appear on two lines of their sheet; FIFO runs across both */
    const shares = allocateSale(
      drawable,
      line.bottles,
      drawn.get(key) ?? new Map(),
      match.shortTo,
    );

    for (const share of shares) {
      addDrawn(key, share.arrangementId, share.bottles);
      sold.push({
        arrangementId: share.arrangementId,
        lwin18: share.lwin18,
        productName: share.productName || line.productName,
        outletCode: line.outletCode,
        bottles: share.bottles,
        short: share.short,
        via: match.via,
      });
    }
  }

  return { sold, unmatched };
};

export default attributeOutletSales;
