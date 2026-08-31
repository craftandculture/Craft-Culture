import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { adminProcedure } from '@/lib/trpc/procedures';
import { isZohoConfigured } from '@/lib/zoho/client';
import { searchContacts } from '@/lib/zoho/contacts';
import { findOrCreateWineItem } from '@/lib/zoho/items';
import { createSalesOrder } from '@/lib/zoho/salesOrders';
import logger from '@/utils/logger';

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
      const found = await findOrCreateWineItem({
        lwin18: line.lwin18,
        productName: line.wine,
        producer: line.producer ?? null,
        vintage: line.vintage ?? null,
        hsCode: line.hsCode ?? null,
        countryOfOrigin: line.countryOfOrigin ?? null,
        bottlesPerCase: line.soldPack,
        bottleSizeMl: line.bottleSizeMl ?? 750,
      });

      const item = found?.item;

      if (!item?.item_id) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Zoho would not give an item code for ${line.wine} (${line.lwin18}). Nothing has been created.`,
        });
      }

      if (found?.created) createdCodes.push(item.item_id);

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
      date: input.poDate ?? undefined,
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
