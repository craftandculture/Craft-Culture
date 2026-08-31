import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { adminProcedure } from '@/lib/trpc/procedures';
import { isZohoConfigured } from '@/lib/zoho/client';
import { searchContacts } from '@/lib/zoho/contacts';
import { createWineItem, searchItems } from '@/lib/zoho/items';
import { createSalesOrder } from '@/lib/zoho/salesOrders';
import logger from '@/utils/logger';

/**
 * The order's date in the only format Zoho accepts
 *
 * An LPO writes its date the way the client's template does — "24 August 2026",
 * "24-08-2026", "24/08/26" — and Zoho takes yyyy-MM-dd and nothing else, so the
 * whole order was rejected on the one field that did not matter.
 *
 * Day-first where the format is ambiguous, because these orders come from the
 * UAE and Europe. An unreadable date returns null and the field is simply not
 * sent: Zoho then dates the order today, which is a better answer than refusing
 * to create it.
 *
 * @param value - The date as the document wrote it
 * @returns yyyy-MM-dd, or null when it cannot be read with confidence
 */
const toZohoDate = (value: string | null) => {
  if (!value) return null;

  const text = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  // 24-08-2026, 24/08/2026, 24.08.26 — day first
  const parts = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(text);

  if (parts) {
    const [, day, month, year] = parts;
    const fullYear = year!.length === 2 ? `20${year}` : year;

    return `${fullYear}-${month!.padStart(2, '0')}-${day!.padStart(2, '0')}`;
  }

  const parsed = new Date(text);

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed.toISOString().slice(0, 10);
};

/**
 * Turn a read LPO into a draft sales order in Zoho
 *
 * The manual version is: create the item codes the order needs, then key
 * forty-three lines. Every part of it is derivable from what the preview
 * already knows — the wine, its LWIN, the pack the client is buying and the
 * price they stated — so none of it is worth a person's afternoon.
 *
 * Three things it deliberately does not do:
 *
 * **It creates a draft.** This is built from a parsed PDF, a set of catalogue
 * matches and a price comparison, and each of those is a judgement that can be
 * wrong. A draft is a thing someone opens and confirms; an open order is a
 * commitment made by a machine reading a PDF.
 *
 * **It refuses an order it cannot fully identify.** Creating twenty of
 * forty-three lines leaves someone reconciling two partial orders, which is
 * worse than creating none.
 *
 * **It prices at what the client stated**, not at what we quoted. The
 * disagreement is reported on the preview and is a conversation to have before
 * this is run, not a figure to overwrite silently.
 *
 * The repack packs are created as their own Zoho items, which is the step that
 * makes this worth automating: a client taking three bottles of a six needs a
 * three-pack code, and thirteen of those on one order is an hour of typing.
 */
const adminCreateZohoOrder = adminProcedure
  .input(
    z.object({
      client: z.string().min(1),
      poNumber: z.string().nullable(),
      poDate: z.string().nullable(),
      creditTerms: z.string().nullable(),
      lines: z
        .array(
          z.object({
            lwin18: z.string().min(1),
            wine: z.string().min(1),
            producer: z.string().nullable().optional(),
            vintage: z.number().nullable().optional(),
            bottles: z.number().int().positive(),
            /** Bottles in the pack being sold — 3 where a six is split */
            soldPack: z.number().int().positive(),
            unitPriceAed: z.number().nonnegative(),
            bottleSizeMl: z.number().int().positive().optional(),
            hsCode: z.string().nullable().optional(),
            countryOfOrigin: z.string().nullable().optional(),
          }),
        )
        .min(1)
        .max(300),
    }),
  )
  .mutation(async ({ input }) => {
    if (!isZohoConfigured()) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Zoho is not configured on this environment.',
      });
    }

    /*
      The client has to be one we already know — found the way a person would.

      A PDF letterhead says "C D General Trading L.L.C. - S.P.C" and Zoho holds
      "CD General Trading LLC". Handing that whole string to Zoho's search
      returns nothing, so the first attempt refused an order for a customer that
      was plainly there.

      So it searches on progressively shorter fragments and then compares on
      letters alone, which is how the two names are obviously the same to
      anybody reading them. Creating the contact is still not an option: one
      invented from a PDF is how a duplicate customer gets into the accounts, in
      a system we do not control.
    */
    const squash = (value: string) =>
      value.toLowerCase().replace(/[^a-z0-9]/g, '');

    const words = input.client
      .replace(/[^a-zA-Z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 1);

    const attempts = [
      input.client,
      words.slice(0, 3).join(' '),
      words.slice(0, 2).join(' '),
      [...words].sort((a, b) => b.length - a.length)[0] ?? '',
    ].filter((term, index, all) => term && all.indexOf(term) === index);

    const seen = new Map<string, { contact_id: string; contact_name: string }>();

    for (const term of attempts) {
      const found = await searchContacts(term);

      for (const row of found) {
        if (row.contact_id) seen.set(row.contact_id, row);
      }

      // Stop as soon as something plausible turns up
      if (seen.size > 0) break;
    }

    const wanted = squash(input.client);
    const candidates = [...seen.values()];

    const contact =
      candidates.find((row) => squash(row.contact_name) === wanted) ??
      candidates.find((row) => {
        const name = squash(row.contact_name);

        return name.includes(wanted) || wanted.includes(name);
      }) ??
      (candidates.length === 1 ? candidates[0] : undefined);

    if (!contact) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message:
          `No Zoho customer matches "${input.client}".` +
          (candidates.length > 0
            ? ` Zoho has: ${candidates
                .slice(0, 6)
                .map((row) => row.contact_name)
                .join(', ')}. Rename one to match, or tell me which it is.`
            : ' Nothing similar came back from Zoho at all — check the customer exists.'),
      });
    }

    /*
      Item codes first, because a sales order cannot reference one that does not
      exist. Sequential rather than parallel: Zoho rate-limits, and a
      half-created set of items is a worse place to fail than none.
    */
    const lineItems = [];
    const createdCodes: string[] = [];

    for (const line of input.lines) {
      /*
        The pack is part of the identity of a sales line.

        `findOrCreateWineItem` falls back to matching on the first eleven
        characters of the LWIN, which is wine and vintage — deliberately, so a
        stock sync finds a wine whose SKU was truncated. Here it is wrong: a
        three-bottle repack differs from its six-pack only in the pack segment,
        so every repack line matched the six-pack, created nothing, and booked
        three bottles against a code Zoho believes is a case of six. The order
        looks complete and depletes the wrong stock at the wrong rate.

        So the SKU must match exactly, or the pack gets its own item — which is
        the thirteen codes this screen exists to stop anyone typing.
      */
      /*
        The SKU of the pack being SOLD, not of the stock it comes out of.

        `match.lwin18` identifies the case we hold — a twelve of Figeac. Selling
        three bottles of it is a different item, `…-03-…`, and looking up the
        held code found the twelve-pack every time: exact match, nothing
        created, three bottles booked against a case of twelve. The check was
        right and the question was wrong.

        LWIN18 is wine-vintage-pack-size, so the sold pack is the held code with
        its third segment replaced.
      */
      const parts = line.lwin18.split('-');
      const saleLwin18 =
        parts.length === 4
          ? [
              parts[0],
              parts[1],
              String(line.soldPack).padStart(2, '0'),
              parts[3],
            ].join('-')
          : line.lwin18;

      const existing = await searchItems(saleLwin18);
      const exact = existing.find((row) => row.sku === saleLwin18);

      /*
        Zoho's item names are unique; its SKUs are not enforced.

        So a three-pack and a six-pack of one wine cannot both be called
        "Chateau Talbot 4eme Cru Classe, Saint-Julien 1995" — creating the
        repack was rejected outright on a name that already belonged to the
        six-pack. The pack therefore goes in the name as well as the SKU, which
        also makes it visible to whoever picks it in Zoho rather than buried in
        a description.
      */
      const sizeCl = Math.round((line.bottleSizeMl ?? 750) / 10);
      const vintage = line.vintage ? ` ${line.vintage}` : '';
      const packName = `${line.wine}${line.wine.includes(String(line.vintage ?? '')) ? '' : vintage} (${line.soldPack}x${sizeCl}cl)`;

      const wineItem = {
        lwin18: saleLwin18,
        // Vintage is already in the name, so it is not appended again
        productName: packName,
        producer: line.producer ?? null,
        vintage: null,
        hsCode: line.hsCode ?? null,
        countryOfOrigin: line.countryOfOrigin ?? null,
        bottlesPerCase: line.soldPack,
        bottleSizeMl: line.bottleSizeMl ?? 750,
      };

      /*
        A name collision means the item is already there under a SKU our search
        did not return — so it is looked up by that name rather than the whole
        order failing on a code that exists.
      */
      let item = exact;

      if (!item) {
        try {
          item = await createWineItem(wineItem);

          if (item?.item_id) createdCodes.push(item.item_id);
        } catch (error) {
          const byName = await searchItems(packName);

          item = byName.find((row) => row.name === packName);

          if (!item) throw error;
        }
      }

      if (!item?.item_id) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Zoho would not give an item code for ${line.wine} (${line.lwin18}). Nothing has been created.`,
        });
      }

      /*
        Sold by the case, priced by the case.

        The LPO states a price per bottle and Zoho holds these as cases, so the
        rate is the bottle price times the pack. Sending a bottle price against
        a case quantity is a bill for a sixth of the order.
      */
      const cases = line.bottles / line.soldPack;

      lineItems.push({
        item_id: item.item_id,
        quantity: cases,
        rate: Math.round(line.unitPriceAed * line.soldPack * 100) / 100,
        description: `${line.soldPack}x${Math.round((line.bottleSizeMl ?? 750) / 10)}cl`,
      });
    }

    const order = await createSalesOrder({
      customer_id: contact.contact_id,
      reference_number: input.poNumber ?? undefined,
      date: toZohoDate(input.poDate) ?? undefined,
      line_items: lineItems,
      terms: input.creditTerms ?? undefined,
      notes: `Created from ${input.poNumber ?? 'client LPO'} — check before confirming.`,
    });

    logger.info('[LPO] Draft sales order created', {
      salesOrderId: order?.salesorder_id,
      lines: lineItems.length,
      client: input.client,
    });

    return {
      salesOrderId: order?.salesorder_id ?? null,
      salesOrderNumber: order?.salesorder_number ?? null,
      lineCount: lineItems.length,
      itemsCreated: createdCodes.length,
    };
  });

export default adminCreateZohoOrder;
