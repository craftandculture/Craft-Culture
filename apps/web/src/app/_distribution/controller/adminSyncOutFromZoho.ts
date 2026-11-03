import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import readConsignmentSubject from '@/app/_triangulation/utils/readConsignmentSubject';
import readInvoiceSubject from '@/app/_triangulation/utils/readInvoiceSubject';
import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';
import { isZohoConfigured } from '@/lib/zoho/client';
import { getInvoice, listInvoices } from '@/lib/zoho/invoices';

import getWineAliases from '../data/getWineAliases';
import canonicalWineCode, { isLwin18 } from '../utils/canonicalWineCode';
import classifyInvoice from '../utils/classifyInvoice';
import type { InvoiceType } from '../utils/classifyInvoice';
import ownerFromRegister from '../utils/ownerFromRegister';
import type { RegisterEntry } from '../utils/ownerFromRegister';
import readOwnerTag from '../utils/readOwnerTag';
import resolveOwner from '../utils/resolveOwner';
import type { OwnerRef } from '../utils/resolveOwner';
import tableReady from '../utils/tableReady';
import wineOwnersReady from '../utils/wineOwnersReady';

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
 * Every invoice to the outlet is read, and each is typed: consignment,
 * prepaid, outright, or a private client order. Only consignment moves money
 * at settlement, but the others still have to be here — City Drinks sell from
 * the stock they bought too, and a sale with no line to land on is a sale
 * nobody can account for. Prepaid and outright lines are kept so those sales
 * draw them down (first, before any consignment line of the same wine) and are
 * neither billed nor paid. PCO invoices are left out altogether.
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

    const hasTypes = await tableReady('cons_invoice_types');
    const hasRegister = await tableReady('cons_outlet_codes');

    const owners = await client<(OwnerRef & { kind: string })[]>`
      SELECT id, name, consignment_tag AS "consignmentTag",
             owner_aliases AS "ownerAliases",
             takes_unattributed AS "takesUnattributed",
             ${hasRegister ? client`kind` : client`'partner'`} AS kind
      FROM cons_owners WHERE is_active
    `;

    /* Whose stock an outright sale is: the outlet's own, nobody to pay */
    const outletOwn = owners.find((owner) => owner.kind === 'outlet-own');

    const typesByHand = hasTypes
      ? await client<{ docRef: string; invoiceType: string; ownerId: string | null }[]>`
          SELECT doc_ref AS "docRef", invoice_type AS "invoiceType",
                 owner_id AS "ownerId"
          FROM cons_invoice_types WHERE outlet_id = ${input.outletId}
        `
      : [];
    /* Codes merged into another wine, applied to every line as it is read */
    const aliases = await getWineAliases(input.outletId);
    const notLwin = new Set<string>();

    const typeByDoc = new Map(
      typesByHand.map((row) => [row.docRef, row.invoiceType]),
    );
    /* Whose an invoice was, set by hand — Cru's prepaid January stock */
    const ownerByDoc = new Map(
      typesByHand
        .filter((row) => row.ownerId)
        .map((row) => [row.docRef, row.ownerId as string]),
    );

    /*
      A PCO is invoiced to the distributor too, and is a client's order, not
      consignment. Known from our own orders rather than read off the document.
    */
    const pcoInvoices = await client<{ number: string }[]>`
      SELECT zoho_invoice_number AS number FROM private_client_orders
      WHERE zoho_invoice_number IS NOT NULL
      UNION
      SELECT invoice_number FROM pco_item_invoicing
      WHERE invoice_number IS NOT NULL
    `;
    const pcoNumbers = new Set(pcoInvoices.map((row) => row.number));

    const register: RegisterEntry[] = hasRegister
      ? await client<RegisterEntry[]>`
          SELECT doc_ref AS "docRef", wine_name AS "wineName",
                 owner_id AS "ownerId"
          FROM cons_outlet_codes
          WHERE outlet_id = ${input.outletId} AND owner_id IS NOT NULL
        `
      : [];

    const arrangementByOwner = new Map(
      arrangements.map((row) => [row.ownerId, row.id]),
    );

    /*
      Every name an owner answers to, tags and aliases alike.

      Scanning for tags alone would never find OPENCELLAR, which is what
      Crurated is called on four invoices — and resolveOwner checks aliases
      only once a tag has been picked out of the subject, so a word nobody
      looks for is a word nobody resolves.
    */
    /*
      Whose a wine is, said by a person. Outranks the document, because a
      person correcting an attribution is more current than the subject line
      that got it wrong — and for a MIX invoice it is the only word there is.
    */
    const overrides = (await wineOwnersReady())
      ? await client<{ lwin18: string; ownerId: string }[]>`
          SELECT lwin18, owner_id AS "ownerId"
          FROM cons_wine_owners WHERE outlet_id = ${input.outletId}
        `
      : [];

    const ownerByWine = new Map(
      overrides.map((row) => [squash(row.lwin18), row.ownerId]),
    );

    const knownTags = owners
      .flatMap((owner) => [owner.consignmentTag, ...(owner.ownerAliases ?? [])])
      .filter((tag): tag is string => Boolean(tag));

    /*
      Whose wine each code was last time. A mixed invoice names its owners in
      heading rows Zoho drops on read, so for those lines the registry is the
      only thing that can answer — and a wine's owner does not change between
      invoices.
    */
    /*
      Every owner a wine has been sent under, not just the latest. Keeping one
      per LWIN (DISTINCT ON) gave a wine two owners both consign to whichever
      invoiced last; with two on record and no tag, the line is flagged for a
      person instead.
    */
    const knownRows = await client<{ lwin18: string; ownerId: string }[]>`
      SELECT DISTINCT m.lwin18, a.owner_id AS "ownerId"
      FROM cons_movements m
      JOIN cons_arrangements a ON a.id = m.arrangement_id
      WHERE m.lwin18 IS NOT NULL AND m.kind = 'out'
        ${hasTypes ? client`AND COALESCE(m.invoice_type, 'consignment') <> 'outright'` : client``}
    `;
    const knownOwnersByLwin = new Map<string, Set<string>>();
    for (const row of knownRows) {
      const key = squash(row.lwin18);
      const set = knownOwnersByLwin.get(key) ?? new Set<string>();
      set.add(row.ownerId);
      knownOwnersByLwin.set(key, set);
    }

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
    const typed: { docRef: string; type: InvoiceType; reason: string }[] = [];
    const unattributed: string[] = [];
    const taken = new Set<string>();
    /* Evidence about the header rows, since the codebase disagrees with itself */
    const headerNames: string[] = [];
    let seenLines = 0;
    let seenHeaders = 0;

    for (const header of headers) {
      const invoice = await getInvoice(header.id);
      const subject = readInvoiceSubject(invoice);
      const consignment = readConsignmentSubject(
        subject,
        invoice.payment_terms_label,
      );

      const invoiceType = classifyInvoice({
        setByHand: typeByDoc.get(invoice.invoice_number),
        taggedConsignment: consignment.isConsignment,
        isPco:
          pcoNumbers.has(invoice.invoice_number) ||
          /\bPCO[-\s]?\d/i.test(invoice.reference_number ?? ''),
      });

      typed.push({
        docRef: invoice.invoice_number,
        type: invoiceType.type,
        reason: invoiceType.reason,
      });

      if (invoiceType.type === 'pco') {
        notConsignment.push(`${header.number} — ${invoiceType.reason}`);
        continue;
      }

      /*
        MIX names several owners and resolves to none, so its lines fall
        through to the wine's own history rather than taking a tag that would
        be wrong for most of them.
      */
      const invoiceTag = readOwnerTag(subject, knownTags);

      /*
        A MIX invoice says whose each wine is, in header rows above the lines.

        INV-000236 carries CONSIGNMENT_CC over thirteen lines, CONSIGNMENT_RARE
        over one and CONSIGNMENT_CRU over three, and every line on it was
        attributed to whoever takes the unattributed — because a header row has
        no quantity and the loop skipped it on the way past. The document had
        the answer on it the whole time.

        Read in order, so a header applies to everything beneath it until the
        next one. Where a header names nobody the invoice's own tag stands,
        which for MIX is nothing, and those lines fall through as before.
      */
      let headerTag: string | null = null;

      /*
        Whether Zoho returns the header rows at all.

        The types say they come back like any other row; the notes on
        readInvoiceSubject say seventy invoices were read and they were not.
        Both cannot be true, and guessing produced a fix that changed nothing.
        So the sync counts what it actually saw and says so.
      */
      seenLines += invoice.line_items?.length ?? 0;

      for (const line of invoice.line_items ?? []) {
        const asHeader =
          line.item_type === 'header' || (!line.quantity && !line.sku);

        if (asHeader) {
          seenHeaders += 1;
          headerNames.push(`${header.number}: ${line.name}`);

          const named = readOwnerTag(line.name, knownTags);

          if (named) headerTag = named;

          continue;
        }

        if (!line.quantity) continue;

        /*
          Dashes put back and merges applied before anything keys on it, so a
          code that lost its dashes or was folded into another wine lands on
          that wine's line.
        */
        const lwin18 = canonicalWineCode(line.sku, aliases).code;

        if (lwin18 && !isLwin18(lwin18)) notLwin.add(lwin18);
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

        const saidByHand = lwin18 ? ownerByWine.get(squash(lwin18)) : null;
        /* The line's own header beats the invoice's tag, being narrower */
        const lineTag = headerTag ?? invoiceTag;
        const registry = lwin18 ? knownOwnersByLwin.get(squash(lwin18)) : undefined;
        /* The Codes tab names the owner of each line against its invoice */
        const listedOwner = ownerFromRegister(
          register,
          invoice.invoice_number,
          line.name,
        );
        const isOwnStock = invoiceType.type === 'outright' && Boolean(outletOwn);

        const invoiceOwner = ownerByDoc.get(invoice.invoice_number) ?? null;

        if (
          !saidByHand &&
          !invoiceOwner &&
          !listedOwner &&
          !isOwnStock &&
          registry &&
          registry.size > 1
        ) {
          // Only a tag on the document, or the Codes tab, can settle a wine with two owners
          const byTag = resolveOwner({
            tag: lineTag,
            knownOwnerId: null,
            owners: owners.map((owner) => ({ ...owner, takesUnattributed: false })),
          });

          if (!byTag.ownerId) {
            unattributed.push(
              `${header.number} · ${line.name} — more than one owner has consigned this wine and the invoice does not say whose; set its owner by hand`,
            );
            continue;
          }
        }

        /*
          Bought outright is City Drinks' own wine, whoever it came from: a
          sale of it is nobody's to be paid for.
        */
        const { ownerId, reason } =
          isOwnStock && outletOwn
            ? { ownerId: outletOwn.id, reason: 'Bought outright by the outlet' }
            : saidByHand
              ? {
                  ownerId: saidByHand,
                  reason: 'Set by hand against the wine',
                }
              : invoiceOwner
                ? { ownerId: invoiceOwner, reason: 'Owner set on the invoice' }
                : resolveOwner({
                  tag: lineTag,
                  registerOwnerId: listedOwner,
                  knownOwnerId:
                    registry && registry.size === 1 ? [...registry][0] : null,
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
          owner_reason: reason,
          ...(hasTypes ? { invoice_type: invoiceType.type } : {}),
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
    // One transaction, so a failed insert never leaves the outlet with no
    // invoiced lines at all
    await client.begin(async (sql) => {
      await sql`
        DELETE FROM cons_movements m
        USING cons_arrangements a
        WHERE m.arrangement_id = a.id
          AND a.outlet_id = ${input.outletId}
          AND m.kind = 'out'
          AND m.source = 'zoho-invoices'
      `;

      if (rows.length > 0) {
        await sql`INSERT INTO cons_movements ${sql(rows)}`;
      }
    });

    return {
      outlet: outlet.outletName,
      invoicesRead: headers.length,
      /*
        What the API actually returned about grouping rows. A MIX invoice names
        its owners in headers; if none arrive, the document's answer never
        reaches us and no amount of parsing recovers it.
      */
      headerRowsSeen: seenHeaders,
      lineRowsSeen: seenLines,
      headerRowsFound: headerNames.slice(0, 10),
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
      /** Codes that are not a LWIN18 — W codes, internal codes — to map or merge */
      notLwin: [...notLwin].slice(0, 25),
      /** How many invoices of each type were read */
      byType: typed.reduce<Record<string, number>>((counts, row) => {
        counts[row.type] = (counts[row.type] ?? 0) + 1;

        return counts;
      }, {}),
      unattributed: unattributed.slice(0, 25),
    };
  });

export default adminSyncOutFromZoho;
