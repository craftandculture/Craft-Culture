import { TRPCError } from '@trpc/server';
import { and, eq, isNull, lt, or } from 'drizzle-orm';
import { z } from 'zod';

import isUsableLwin18 from '@/app/_lwin/utils/isUsableLwin18';
import db from '@/database/client';
import { privateClientOrders } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import { isZohoConfigured } from '@/lib/zoho/client';
import { createWineItem, searchItems, updateItem } from '@/lib/zoho/items';
import { createSalesOrder } from '@/lib/zoho/salesOrders';
import logger from '@/utils/logger';

import planZohoSalesOrder, {
  CLAIM,
  CLAIM_TIMEOUT_MS,
} from '../utils/planZohoSalesOrder';

/**
 * Raise a draft Zoho sales order from a private client order
 *
 * The manual version is opening Zoho, finding the distributor, checking each
 * price against the trade list, creating any pack codes the order needs and
 * keying every line — for an order that is already sitting in the system in
 * full. Nothing in that is a judgement; all of it is retyping.
 *
 * Three decisions worth stating, because each could sensibly have gone the
 * other way:
 *
 * **It is a draft.** Confirmed and invoiced by a person in Zoho. This is a
 * document that moves wine out of the free zone and bills a distributor for it;
 * the last press should be a human one.
 *
 * **It bills what was agreed, not what the cost model says today.** The price
 * on each line is the one struck for this order; the catalogue's trade price is
 * only a check, and a line below it is pointed out rather than overwritten. A
 * catalogue that moves between the order and the invoice must not quietly
 * change the amount somebody is billed.
 *
 * **A line with no price at all is included at zero, and named.** Refusing the
 * order would stop a sale over a missing figure. But a zero on this document is
 * a customs value, so it comes back in `unpriced` for the screen to show and for
 * the person confirming in Zoho to fill in.
 */
const adminCreateZohoSalesOrder = adminProcedure
  .input(
    z.object({
      orderId: z.string().uuid(),
      /**
       * Acknowledgement that new item codes and unpriced lines were seen.
       *
       * The preview decides whether this is needed; it is required here so a
       * caller that skips the preview cannot mint codes silently.
       */
      confirmed: z.boolean().default(false),
    }),
  )
  .mutation(async ({ input }) => {
    if (!isZohoConfigured()) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Zoho is not configured on this environment.',
      });
    }

    const plan = await planZohoSalesOrder(input.orderId);

    if (!plan) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
    }

    if (plan.blockers.length > 0) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: plan.blockers.join(' '),
      });
    }

    if (!plan.customer) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'No Zoho customer is linked to this distributor.',
      });
    }

    /*
      Claim the order before calling Zoho, not after.

      Writing the id back at the end leaves the whole of the Zoho round trip —
      several item lookups, possibly a few creations, then the order itself —
      with nothing marking the order as taken. Two presses inside that window
      both find a clean order and both raise one, which is two sales orders for
      one PCO and a reconciliation nobody would enjoy. The guard is the WHERE
      clause: only the press that finds the column still null proceeds.
    */
    const [claimed] = await db
      .update(privateClientOrders)
      .set({ zohoSalesOrderId: CLAIM, updatedAt: new Date() })
      .where(
        and(
          eq(privateClientOrders.id, input.orderId),
          /*
            Unclaimed, or claimed so long ago that the process holding it is
            gone. The claim is handed back on any failure, but a server that
            dies between taking it and releasing it would otherwise lock this
            order out of ever raising a sales order, with nothing on the screen
            able to clear it.
          */
          or(
            isNull(privateClientOrders.zohoSalesOrderId),
            and(
              eq(privateClientOrders.zohoSalesOrderId, CLAIM),
              lt(
                privateClientOrders.updatedAt,
                new Date(Date.now() - CLAIM_TIMEOUT_MS),
              ),
            ),
          ),
        ),
      )
      .returning({ id: privateClientOrders.id });

    if (!claimed) {
      throw new TRPCError({
        code: 'CONFLICT',
        message:
          'A sales order is already being raised from this order, or has been.',
      });
    }

    /** Hand the order back so a failure does not leave it permanently claimed */
    const unclaim = async () => {
      await db
        .update(privateClientOrders)
        .set({ zohoSalesOrderId: null, updatedAt: new Date() })
        .where(
          and(
            eq(privateClientOrders.id, input.orderId),
            eq(privateClientOrders.zohoSalesOrderId, CLAIM),
          ),
        );
    };

    try {
      const lineItems = [];
      const created: string[] = [];

      /*
        Item codes first — a sales order cannot reference one that does not
        exist. Sequential rather than parallel: Zoho rate-limits, and a
        half-created set of items is a worse place to fail than none.
      */
      for (const line of plan.lines) {
        const found = await searchItems(line.saleLwin18);
        let item = found.find((row) => row.sku === line.saleLwin18);

        if (!item && !input.confirmed) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message:
              `${line.packName} has no item code in Zoho and one would be created. ` +
              'Review the order first.',
          });
        }

        if (!item) {
          try {
            item = await createWineItem({
              lwin18: line.saleLwin18,
              // The pack and vintage are already in the name
              productName: line.packName,
              producer: line.producer,
              vintage: null,
              hsCode: null,
              countryOfOrigin: null,
              bottlesPerCase: line.pack,
              bottleSizeMl: line.bottleSizeMl,
            });

            if (item?.item_id) created.push(line.packName);
          } catch (error) {
            /*
              Zoho enforces unique item NAMES rather than SKUs, so a rejected
              creation usually means the item is already there under a SKU the
              search did not return. Looked up by name before giving up.
            */
            const byName = await searchItems(line.packName);

            item = byName.find((row) => row.name === line.packName);

            if (!item) throw error;

            /*
              Found by name, so its SKU is unchecked. One minted from a
              placeholder ("…:row28") is ours to correct — it is this wine under
              a code nothing matches. Any other SKU is a different wine sharing
              the name, and billing against it would deplete the wrong stock.
            */
            if (item.sku !== line.saleLwin18) {
              if (item.sku && isUsableLwin18(item.sku)) {
                throw new TRPCError({
                  code: 'CONFLICT',
                  message:
                    `Zoho already has "${line.packName}" under SKU ${item.sku}, ` +
                    `not ${line.saleLwin18}. Check which code is right before raising.`,
                });
              }

              item = await updateItem(item.item_id, { sku: line.saleLwin18 });

              logger.info('[PCO] Repaired placeholder Zoho SKU', {
                itemId: item?.item_id,
                name: line.packName,
                sku: line.saleLwin18,
              });
            }
          }
        }

        if (!item?.item_id) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Zoho would not give an item code for ${line.packName}.`,
          });
        }

        lineItems.push({
          item_id: item.item_id,
          quantity: line.cases,
          rate: line.ratePerCase,
          description: `${line.pack}x${Math.round(line.bottleSizeMl / 10)}cl`,
        });
      }

      const order = await createSalesOrder({
        customer_id: plan.customer.contactId,
        /*
          Stated rather than inherited from the customer. An unstated currency
          is how dirham figures came to print as dollars on an LPO order worth a
          quarter of what it said.
        */
        currency_code: 'USD',
        /*
          The PCO number, which is the only thing that has ever joined these two
          systems and the first thing anyone looks for.
        */
        reference_number: plan.order.orderNumber,
        line_items: lineItems,
        notes:
          `Raised from ${plan.order.orderNumber} for ${plan.order.clientName}. ` +
          'Priced at the agreed line prices — what the distributor is billed, ' +
          'before their own margin and VAT. Check before confirming.' +
          (plan.unpriced.length > 0
            ? ` NEEDS A PRICE — no price on the order line, sent at zero: ${plan.unpriced.join('; ')}.`
            : '') +
          (plan.belowTrade.length > 0
            ? ` Below the cost model's price: ${plan.belowTrade.join('; ')}.`
            : ''),
      });

      if (!order?.salesorder_id) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Zoho did not return a sales order. Nothing was raised.',
        });
      }

      await db
        .update(privateClientOrders)
        .set({
          zohoSalesOrderId: order.salesorder_id,
          zohoSalesOrderNumber: order.salesorder_number ?? null,
          zohoSalesOrderCreatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(privateClientOrders.id, input.orderId));

      logger.info('[PCO] Draft sales order created', {
        orderNumber: plan.order.orderNumber,
        salesOrderId: order.salesorder_id,
        lines: lineItems.length,
        itemsCreated: created.length,
        unpriced: plan.unpriced.length,
      });

      return {
        salesOrderId: order.salesorder_id,
        salesOrderNumber: order.salesorder_number ?? null,
        lineCount: lineItems.length,
        itemsCreated: created,
        unpriced: plan.unpriced,
        orderTotal: Math.round(plan.orderTotal * 100) / 100,
        belowTrade: plan.belowTrade,
      };
    } catch (error) {
      await unclaim();
      throw error;
    }
  });

export default adminCreateZohoSalesOrder;
