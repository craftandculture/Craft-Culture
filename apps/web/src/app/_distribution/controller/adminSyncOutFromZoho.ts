import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import readConsignmentSubject from '@/app/_triangulation/utils/readConsignmentSubject';
import readInvoiceSubject from '@/app/_triangulation/utils/readInvoiceSubject';
import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';
import { isZohoConfigured } from '@/lib/zoho/client';
import { getInvoice, listInvoices } from '@/lib/zoho/invoices';

import readOwnerTag from '../utils/readOwnerTag';
import resolveOwner from '../utils/resolveOwner';
import type { OwnerRef } from '../utils/resolveOwner';

/** Stop rather than page forever if Zoho keeps saying there is more */
const MAX_PAGES = 40;

interface ArrangementRow {
  id: string;
  ownerId: string;
  outletId: string;
  outletName: string;
  zohoCustomerMatch: string | null;
}

/** "6x75cl" in a line description — the only place the pack is stated */
const PACK_IN_DESCRIPTION = /(\d+)\s*[x×]\s*\d/i;

const squash = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Read what we invoiced out to an outlet
 *
 * The Out position: bottles that left us for a distributor, priced at what we
 * billed them. Everything before this is the warehouse's business — a wine can
 * be drawn down by several arrangements and by outright sales, so what we still
 * hold is read from `wms_stock` rather than reconstructed here.
 *
 * Quantities become bottles once, at this boundary. The outlet counts bottles
 * and we invoice cases, so the pack is the only multiplier in the system and
 * the quietest way to be wrong by six — which is why what the document actually
 * said is kept beside the computed figure.
 *
 * Only consignment invoices count. Wine an outlet bought outright is theirs,
 * and reading it here would count it as consigned and then chase its owner for
 * a bill they never owed.
 *
 * @param outletId - Which outlet to read invoices for
 * @returns What was taken, what was left out, and why
 */
const adminSyncOutFromZoho = adminProcedure
  .input(z.object({ outletId: z.string().uuid() }))
  .mutation(async ({ input }) => {
    if (!isZohoConfigured()) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Zoho integration is not configured',
      });
    }

    const arrangements = await client<ArrangementRow[]>`
      SELECT a.id, a.owner_id AS "ownerId", a.outlet_id AS "outletId",
             o.name AS "outletName", o.zoho_customer_match AS "zohoCustomerMatch"
      FROM cons_arrangements a
      JOIN cons_outlets o ON o.id = a.outlet_id
      WHERE a.outlet_id = ${input.outletId} AND a.is_active
    `;

    const outlet = arrangements[0];

    if (!outlet) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message:
          'That outlet has no active arrangement, so there is no owner to attribute its wine to.',
      });
    }

    if (!outlet.zohoCustomerMatch) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `${outlet.outletName} has no Zoho customer name set, so its invoices cannot be found.`,
      });
    }

    const owners = await client<OwnerRef[]>`
      SELECT id, name, consignment_tag AS "consignmentTag",
             owner_aliases AS "ownerAliases",
             takes_unattributed AS "takesUnattributed"
      FROM cons_owners WHERE is_active
    `;

    const arrangementByOwner = new Map(
      arrangements.map((row) => [row.ownerId, row.id]),
    );

    /*
      Whose wine each code was last time. A mixed invoice names its owners in
      heading rows Zoho drops on read, so for those lines the registry is the
      only thing that can answer — and a wine's owner does not change between
      invoices.
    */
    const knownRows = await client<{ lwin18: string; ownerId: string }[]>`
      SELECT DISTINCT ON (m.lwin18) m.lwin18, a.owner_id AS "ownerId"
      FROM cons_movements m
      JOIN cons_arrangements a ON a.id = m.arrangement_id
      WHERE m.lwin18 IS NOT NULL AND m.kind = 'out'
      ORDER BY m.lwin18, m.doc_date DESC NULLS LAST, m.created_at DESC
    `;
    const knownOwnerByLwin = new Map(
      knownRows.map((row) => [squash(row.lwin18), row.ownerId]),
    );

    const wanted = squash(outlet.zohoCustomerMatch);
    const headers: { id: string; number: string }[] = [];
    let page = 1;
    let more = true;

    while (more && page <= MAX_PAGES) {
      const result = await listInvoices({ page, perPage: 200 });

      for (const invoice of result.invoices) {
        if (invoice.status === 'void' || invoice.status === 'draft') continue;
        if (!squash(invoice.customer_name ?? '').includes(wanted)) continue;

        headers.push({ id: invoice.invoice_id, number: invoice.invoice_number });
      }

      more = result.pageContext?.has_more_page ?? false;
      page += 1;
    }

    const rows: Record<string, unknown>[] = [];
    const notConsignment: string[] = [];
    const unattributed: string[] = [];
    const taken = new Set<string>();

    for (const header of headers) {
      const invoice = await getInvoice(header.id);
      const subject = readInvoiceSubject(invoice);
      const consignment = readConsignmentSubject(
        subject,
        invoice.payment_terms_label,
      );

      if (!consignment.isConsignment) {
        notConsignment.push(`${header.number} — ${consignment.reason}`);
        continue;
      }

      /*
        MIX names several owners and resolves to none, so its lines fall
        through to the wine's own history rather than taking a tag that would
        be wrong for most of them.
      */
      const invoiceTag = readOwnerTag(subject);

      for (const line of invoice.line_items ?? []) {
        if (!line.quantity) continue;

        const lwin18 = line.sku?.trim() || null;
        const statedPack = PACK_IN_DESCRIPTION.exec(line.description ?? '');
        const isBottles = /bottle|btl/i.test(line.unit ?? '');
        const parsedPack = statedPack?.[1] ? Number(statedPack[1]) : null;
        /*
          A pack only counts when the document states it. Assuming six where
          nothing was said is how a 3-pack of Margaux becomes six bottles, so
          an unstated pack is one and the line is flagged rather than guessed.
        */
        const packStated =
          !isBottles && parsedPack !== null && parsedPack >= 1 && parsedPack <= 24;
        const pack = packStated ? parsedPack! : 1;

        const { ownerId, reason } = resolveOwner({
          tag: invoiceTag,
          knownOwnerId: lwin18 ? knownOwnerByLwin.get(squash(lwin18)) : null,
          owners,
        });

        const arrangementId = ownerId ? arrangementByOwner.get(ownerId) : null;

        if (!arrangementId) {
          unattributed.push(`${header.number} · ${line.name} — ${reason}`);
          continue;
        }

        taken.add(header.number);
        rows.push({
          arrangement_id: arrangementId,
          kind: 'out',
          lwin18,
          product_name: line.name,
          bottles: line.quantity * pack,
          source_qty: line.quantity,
          source_unit: isBottles ? 'bottle' : 'case',
          pack,
          pack_assumed: !packStated && !isBottles,
          unit_price: line.rate,
          currency: invoice.currency_code ?? null,
          doc_ref: invoice.invoice_number,
          doc_date: invoice.date,
          source: 'zoho-invoices',
        });
      }
    }

    /*
      Rebuilt, not appended. Re-running otherwise doubles every bottle, and the
      feed is the authority on its own lines — anything it no longer returns
      has been voided or retagged in Zoho and should leave here too.
    */
    await client`
      DELETE FROM cons_movements m
      USING cons_arrangements a
      WHERE m.arrangement_id = a.id
        AND a.outlet_id = ${input.outletId}
        AND m.kind = 'out'
        AND m.source = 'zoho-invoices'
    `;

    if (rows.length > 0) {
      await client`INSERT INTO cons_movements ${client(rows)}`;
    }

    return {
      outlet: outlet.outletName,
      invoicesRead: headers.length,
      invoicesTaken: taken.size,
      lines: rows.length,
      bottles: rows.reduce((sum, row) => sum + Number(row.bottles ?? 0), 0),
      packAssumed: rows.filter((row) => row.pack_assumed).length,
      /*
        Bottles per owner. Everything landing on one owner is what a broken
        tag read looks like, and it is indistinguishable from a real total
        unless the split is stated.
      */
      byArrangement: Object.entries(
        rows.reduce<Record<string, number>>((totals, row) => {
          const key = String(row.arrangement_id);

          totals[key] = (totals[key] ?? 0) + Number(row.bottles ?? 0);

          return totals;
        }, {}),
      ).map(([arrangementId, bottles]) => ({
        owner:
          arrangements.find((row) => row.id === arrangementId)?.ownerId ??
          arrangementId,
        bottles,
      })),
      notConsignment: notConsignment.slice(0, 25),
      unattributed: unattributed.slice(0, 25),
    };
  });

export default adminSyncOutFromZoho;
