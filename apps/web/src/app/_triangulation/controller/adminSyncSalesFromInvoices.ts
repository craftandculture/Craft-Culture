import { TRPCError } from '@trpc/server';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';
import { isZohoConfigured } from '@/lib/zoho/client';
import { getInvoice, listInvoices } from '@/lib/zoho/invoices';

import insertRows from '../data/insertRows';
import mapImportLines from '../data/mapImportLines';
import { syncSalesFromZohoSchema } from '../schemas/triangulationSchemas';
import normalizeCode from '../utils/normalizeCode';
import resolveProgrammeId from '../utils/programmeId';
import readConsignmentSubject, {
  OWNER_BY_TAG,
} from '../utils/readConsignmentSubject';
import readInvoiceSubject from '../utils/readInvoiceSubject';
import tokenizeMatch from '../utils/tokenizeMatch';

/** Stop rather than page forever if Zoho keeps saying there is more */
const MAX_PAGES = 40;

/**
 * Build Sold to City Drinks from the invoices themselves
 *
 * The feed read sales order lines, because that is where line detail happened
 * to be synced — and it quietly lost every sale that had no order behind it.
 * The early Crurated invoices were raised before there were systems and have
 * no sales order at all, so their bottles were absent from the reconciliation
 * with nothing to indicate anything was missing.
 *
 * An invoice is the sale. Reading invoices directly takes the legacy ones and
 * the current ones on the same footing, and removes the question of whether an
 * order counts as sold — an issued invoice always does.
 *
 * Void invoices are skipped. Drafts are skipped too: they are not yet a sale
 * and would inflate what has left the building.
 */
const adminSyncSalesFromInvoices = adminProcedure
  .input(syncSalesFromZohoSchema)
  .mutation(async ({ input, ctx }) => {
    const programmeId = resolveProgrammeId(input.programmeId);
    if (!isZohoConfigured()) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Zoho integration not configured',
      });
    }

    const { customerMatch } = input;
    const asOfDate = input.asOfDate ?? new Date().toISOString().slice(0, 10);
    const tokens = tokenizeMatch(customerMatch);

    if (tokens.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Customer name must contain at least one letter or number',
      });
    }

    const matchesCustomer = (name: string) => {
      const flat = name.toUpperCase().replace(/[^A-Z0-9]/g, '');

      return tokens.every((token) => flat.includes(token));
    };

    // The list endpoint returns headers only, so every invoice that survives
    // the customer filter has to be fetched again for its lines.
    const headers: { invoiceId: string; invoiceNumber: string }[] = [];
    let page = 1;
    let more = true;

    while (more && page <= MAX_PAGES) {
      const result = await listInvoices({ page, perPage: 200 });

      for (const invoice of result.invoices) {
        if (!matchesCustomer(invoice.customer_name)) continue;
        if (invoice.status === 'void' || invoice.status === 'draft') continue;

        headers.push({
          invoiceId: invoice.invoice_id,
          invoiceNumber: invoice.invoice_number,
        });
      }

      more = result.pageContext?.has_more_page ?? false;
      page += 1;
    }

    if (headers.length === 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `No issued invoices found for a customer matching "${customerMatch}"`,
      });
    }

    /*
      What this client claims. A programme with no tag claims nothing by name
      and reads exactly as it did before owners existed, so an unconfigured
      client is visibly empty rather than quietly holding someone else's wine.
    */
    const [claim] = await client<
      { consignmentTag: string | null; takesUnattributed: boolean }[]
    >`
      SELECT
        to_jsonb(p) ->> 'consignment_tag' AS "consignmentTag",
        COALESCE((to_jsonb(p) ->> 'takes_unattributed')::boolean, false)
          AS "takesUnattributed"
      FROM tri_programmes p
      WHERE p.id = ${programmeId}
      LIMIT 1
    `;

    const ownerClaimed = claim?.consignmentTag
      ? (OWNER_BY_TAG[claim.consignmentTag] ?? null)
      : null;
    const takesUnattributed = claim?.takesUnattributed ?? false;

    const rows: Record<string, unknown>[] = [];
    const invoiceNumbers: string[] = [];
    /** Invoices belonging to another client, which this one must not absorb */
    const otherOwners = new Map<string, number>();
    let skippedLines = 0;
    /** Kept, but only nameable by description until Zoho gives the item a SKU */
    let codelessLines = 0;
    /** Invoices to this customer that are not consignment, and why */
    const nonConsignment: string[] = [];
    /*
      Consignment invoices whose owner tag is not one we know.

      The brief named four owners and the invoices carry at least five —
      CONSIGNMENT_CULT was found only by reading a real one. An unknown tag is
      still counted, but it attributes per line rather than by name, so it has
      to be visible or the list of owners stays wrong indefinitely.
    */
    const unknownTags = new Set<string>();
    /** What the first few invoices carried, so an empty feed can be diagnosed */
    const evidence: string[] = [];
    /** Owner heading rows found inside invoices, which is how a MIX splits */
    const headingsSeen = new Set<string>();
    /**
     * How many invoices carried a subject line at all.
     *
     * The sample alone could not answer this: it took whichever invoices came
     * first, which are the newest, and those may simply be untagged while the
     * older ones carry the tag the document prints.
     */
    let withSubject = 0;

    // Both feeds describe the same sales, so the order-based one goes with
    // this one's own previous run. Leaving it would double Sold to City
    // Drinks — and halve what C&C appears to hold — while looking like the
    // fix had worked.
    await client`
      DELETE FROM tri_imports
      WHERE kind = 'cc_sales_to_cd'
        AND source_ref IN ('zoho-invoices', 'zoho-sales')
      AND programme_id = ${programmeId}
    `;

    const [created] = await client<{ id: string }[]>`
      INSERT INTO tri_imports (
        programme_id, period_id, kind, status, file_name, source_ref, alias_source,
        as_of_date, notes, uploaded_by, committed_at
      )
      VALUES (
        ${programmeId},
        NULL, 'cc_sales_to_cd', 'committed',
        ${`Zoho invoices — ${customerMatch}`}, 'zoho-invoices', 'zoho',
        ${asOfDate},
        ${'Read from the invoices themselves, so sales with no sales order behind them are included.'},
        ${ctx.user.id}, NOW()
      )
      RETURNING id
    `;

    const importId = created?.id;

    if (!importId) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create the Zoho invoice feed',
      });
    }

    for (const header of headers) {
      const invoice = await getInvoice(header.invoiceId);

      /*
        Only stock we consigned belongs in this reconciliation. Wine City
        Drinks bought outright is their own, and reading it here counted it as
        consigned and then chased its owner for a bill they never owed.

        The subject is read from the invoice fetched here rather than from the
        list response, because the list does not reliably carry it.
      */
      const subject = readInvoiceSubject(invoice);
      const consignment = readConsignmentSubject(
        subject,
        invoice.payment_terms_label,
      );

      /*
        What the first few invoices actually carried, whatever was decided
        about them.

        The filter emptied a client's feed completely and nothing on screen
        could say whether that was the right answer, a subject Zoho does not
        return, or a tag nobody recognised. Those need different fixes and the
        resulting figure — zero — is identical for all three.
      */
      if (subject) withSubject += 1;

      /*
        Invoices that DO carry a subject are the informative ones, so they are
        kept in preference to the first six encountered — otherwise a run can
        report "no subject anywhere" having looked only at the newest.
      */
      if (subject && evidence.length >= 6) evidence.shift();

      if (subject || evidence.length < 6) {
        /*
          The custom fields are listed by label because the subject is printed
          on the document and absent from the API response, so the field it
          actually lives in has to be found by looking rather than guessed at
          a third time.
        */
        const custom = (invoice.custom_fields ?? [])
          .map((f) => `${f.label ?? f.api_name ?? '?'}=${String(f.value ?? '')}`)
          .join(', ');

        evidence.push(
          `${invoice.invoice_number}: subject=${subject ?? '(none)'} · terms=${invoice.payment_terms_label ?? '(none)'} · ref=${invoice.reference_number ?? '(none)'} · custom=[${custom || 'none returned'}] · read as ${consignment.ownerName ?? (consignment.isConsignment ? 'consignment, no owner' : 'not consignment')}`,
        );
      }

      if (!consignment.isConsignment) {
        nonConsignment.push(`${invoice.invoice_number} — ${consignment.reason}`);
        continue;
      }

      /*
        Whose wine this is against whose client we are looking at.

        Without this every client's feed read every consignment invoice, so
        Cult's programme filled with Crurated's wine and seeding a registry
        from it would have given Cult several hundred wines it has never
        owned. An invoice naming an owner goes to that owner alone; one naming
        nobody goes to whoever takes the unattributed, which is where it has
        always gone.
      */
      /*
        A MIX invoice belongs to several clients at once, so the decision is
        taken per line rather than per invoice. An invoice naming one owner
        throughout still resolves the same way — every line inherits it.
      */

      if (consignment.isMixed && /unrecognised owner/.test(consignment.reason)) {
        unknownTags.add(`${invoice.invoice_number}: ${subject ?? ''}`);
      }

      invoiceNumbers.push(invoice.invoice_number);

      /*
        Whose wine the lines beneath belong to.

        A CONSIGNMENT_MIX invoice groups its items under heading rows —
        "CONSIGNMENT_CC", then "CONSIGNMENT_RARE" — and Zoho returns those
        headings in `line_items` like any other row. Reading them is what lets
        one invoice settle against two clients; without it the whole document
        went to whoever took the unattributed.

        Starts at the invoice's own owner, so a single-owner invoice needs no
        headings at all.
      */
      let lineOwner = consignment.ownerName;

      for (const line of invoice.line_items ?? []) {
        /*
          A heading names an owner and sells nothing. Recognised on the name
          rather than on `item_type`, since a row typed as an ordinary item but
          named CONSIGNMENT_RARE means exactly the same thing to the person who
          wrote it, and quantity is what separates the two.
        */
        /*
          Zoho drops its own heading rows on read, so a mixed invoice can only
          be split if the owner is written where the API does deliver —
          the line's description, beside the pack size: "3x75cl CONSIGNMENT_CC".
          The name is still read first, for the day headings start arriving.
        */
        const heading = readConsignmentSubject(
          `${line.name ?? ''} ${line.description ?? ''}`,
          null,
        );

        if (heading.isConsignment && !line.quantity) {
          lineOwner = heading.ownerName ?? lineOwner;
          headingsSeen.add(`${invoice.invoice_number}: ${line.name.trim()}`);
          continue;
        }

        /*
          A tagged line is a wine, not a heading: it names its own owner and
          sells something. The owner applies to this line alone rather than
          carrying down, since a description is written per line.
        */
        const lineTagged = heading.isConsignment ? heading.ownerName : null;

        if (!line.quantity) continue;

        /*
          Now the line's owner is known, decide whether it is this client's.
          Lines belonging elsewhere are counted and left for their own client
          rather than absorbed into this one.
        */
        const owner = lineTagged ?? lineOwner;
        const belongsHere = owner ? owner === ownerClaimed : takesUnattributed;

        if (!belongsHere) {
          const label = owner ?? 'no stated owner';

          otherOwners.set(label, (otherOwners.get(label) ?? 0) + 1);
          continue;
        }

        const code = line.sku ?? '';
        const normalized = normalizeCode(code);
        const description = `${line.name}${line.description ? ` (${line.description})` : ''}`;

        // An item with no SKU in Zoho used to be dropped here, and dropping it
        // put the line beyond reach of every diagnostic the tool has: absent
        // from the figures, absent from the mapping queue, and visible only as
        // a number in a toast nobody keeps. INV-000260 carried one such line
        // and its 12 bottles simply were not in the report.
        //
        // A line with a name can still be identified — uploads have always
        // keyed codeless rows on their description, and `mapImportLines` runs
        // that same backfill over this feed. So it is kept and left unmapped,
        // which puts it in the queue where someone can name the wine.
        if (!normalized) codelessLines += 1;

        if (!normalized && !description.trim()) {
          // Neither a code nor a name. Nothing could file this one.
          skippedLines += 1;
          continue;
        }

        // Zoho states the unit on the line. When it says bottles the quantity
        // is already bottles, and the pack is resolved on the mapped SKU.
        const isBottles = /bottle|btl/i.test(line.unit ?? '');
        const match = /(\d+)\s*[x×]\s*\d/i.exec(line.description ?? '');
        const stated = match?.[1] ? Number(match[1]) : null;
        const pack =
          isBottles || !stated || stated < 1 || stated > 24 ? 1 : stated;

        rows.push({
          import_id: importId,
          raw_code: normalized ? code : null,
          normalized_code: normalized || null,
          raw_description: description,
          quantity: line.quantity,
          unit: isBottles ? 'bottle' : 'case',
          case_config: pack,
          quantity_bottles: line.quantity * pack,
          unit_price: line.rate,
          currency: invoice.currency_code ?? null,
          doc_ref: invoice.invoice_number,
          doc_date: invoice.date,
          // The heading's owner where the invoice grouped its lines, else the
          // invoice's own. Null only when neither said.
          stated_owner_name: owner,
          status: 'unmapped',
        });
      }
    }

    if (rows.length > 0) {
      await insertRows(
        'tri_import_lines',
        [
          'import_id',
          'raw_code',
          'normalized_code',
          'raw_description',
          'quantity',
          'unit',
          'case_config',
          'quantity_bottles',
          'unit_price',
          'currency',
          'doc_ref',
          'doc_date',
          'stated_owner_name',
          'status',
        ],
        rows,
      );
    }

    const mapped = await mapImportLines(importId, 'zoho');

    return {
      importId,
      asOfDate,
      invoices: invoiceNumbers,
      orderLines: rows.length,
      codelessLines,
      skippedLines,
      mappedRowCount: mapped.mappedRowCount,
      totalBottles: mapped.totalBottles,
      /*
        Every invoice left out, and why. A consignment filter that is too
        strict looks identical to a quiet month, so what it excluded has to be
        readable rather than inferred from a total that came out low.
      */
      nonConsignmentCount: nonConsignment.length,
      nonConsignmentInvoices: nonConsignment.slice(0, 25),
      /** Consignment invoices carrying an owner tag the tool does not know */
      unknownOwnerTags: [...unknownTags].slice(0, 25),
      /** This client's tag, so an unconfigured one explains its own emptiness */
      consignmentTag: claim?.consignmentTag ?? null,
      /** What the sampled invoices carried, whatever was decided */
      evidence,
      /** How many of every invoice read carried a subject line at all */
      withSubject,
      /** How many invoices were read in total, so the sample can be judged */
      invoicesRead: headers.length,
      /** Owner headings found inside invoices, which is how a MIX splits */
      headings: [...headingsSeen].slice(0, 25),
      /** Consignment lines belonging to other clients, by owner */
      otherOwners: [...otherOwners.entries()].map(
        ([owner, count]) => `${owner}: ${count}`,
      ),
    };
  });

export default adminSyncSalesFromInvoices;
