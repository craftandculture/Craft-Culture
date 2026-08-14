import { TRPCError } from '@trpc/server';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';
import { isZohoConfigured } from '@/lib/zoho/client';
import { getInvoice, listInvoices } from '@/lib/zoho/invoices';

import insertRows from '../data/insertRows';
import mapImportLines from '../data/mapImportLines';
import { syncSalesFromZohoSchema } from '../schemas/triangulationSchemas';
import normalizeCode from '../utils/normalizeCode';
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

    const rows: Record<string, unknown>[] = [];
    const invoiceNumbers: string[] = [];
    let skippedLines = 0;

    await client`
      DELETE FROM tri_imports
      WHERE kind = 'cc_sales_to_cd' AND source_ref = 'zoho-invoices'
    `;

    const [created] = await client<{ id: string }[]>`
      INSERT INTO tri_imports (
        period_id, kind, status, file_name, source_ref, alias_source,
        as_of_date, notes, uploaded_by, committed_at
      )
      VALUES (
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

      invoiceNumbers.push(invoice.invoice_number);

      for (const line of invoice.line_items ?? []) {
        if (!line.quantity) continue;

        const code = line.sku ?? '';

        if (!normalizeCode(code)) {
          // Nothing to file it under. Counted here so a wine that never
          // reaches the figures is a number someone can see.
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
          raw_code: code,
          normalized_code: normalizeCode(code),
          raw_description: `${line.name}${line.description ? ` (${line.description})` : ''}`,
          quantity: line.quantity,
          unit: isBottles ? 'bottle' : 'case',
          case_config: pack,
          quantity_bottles: line.quantity * pack,
          unit_price: line.rate,
          currency: invoice.currency_code ?? null,
          doc_ref: invoice.invoice_number,
          doc_date: invoice.date,
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
      skippedLines,
      mappedRowCount: mapped.mappedRowCount,
      totalBottles: mapped.totalBottles,
    };
  });

export default adminSyncSalesFromInvoices;
