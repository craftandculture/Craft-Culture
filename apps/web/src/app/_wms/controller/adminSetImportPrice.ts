import { TRPCError } from '@trpc/server';
import { and, eq, gte, sql } from 'drizzle-orm';

import db from '@/database/client';
import { wmsProductPricing, wmsStock } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { setImportPriceSchema } from '../schemas/pricingSchema';
import invoicedImportMessage from '../utils/invoicedImportMessage';
import lotInvoiceCost from '../utils/lotInvoiceCost';
import lotShipmentCost from '../utils/lotShipmentCost';
import lwinPakKey from '../utils/lwinPakKey';
import pakKeyOf from '../utils/pakKeyOf';
import writeProductPricing from '../utils/writeProductPricing';

/**
 * Set the import price for a product, on every pack of the wine
 *
 * This was the one pricing edit left writing to the exact LWIN18 only. A wine
 * held as a 2-pack and a 3-pack keeps one price row per pack; the import typed
 * on one landed there alone, the Pricing Manager showed MAX() across both, and
 * the price list — which prefers the line's own row — kept pricing from the
 * old figure. Cristal Rosé 2013 read $546.92 internally and $444.01 on the
 * price list for exactly this reason.
 *
 * A re-costed wine drops off the price lists until someone re-checks it, so the
 * release is cleared whenever any of the wine's rows held a different cost.
 *
 * A typed price is refused where the stock's own supplier invoice line sets the
 * cost, because the Pricing Manager prices from the invoice there and the typed
 * figure would be ignored while the save reported success (and still took the
 * wine off the price lists). The Import cell is locked for those rows; this
 * catches a stale screen. Without an owner (Stock Explorer) it is refused only
 * when every holder's stock is invoiced, since the price still reaches the
 * others. An in-transit line is never refused: a typed price wins there.
 *
 * @param lwin18 - The product LWIN18 identifier
 * @param importPricePerBottle - Price per bottle in USD
 * @param source - Whether price was set manually or from a shipment
 * @param shipmentItemId - Optional reference to the source shipment item
 * @param notes - Optional notes about the price
 */
const adminSetImportPrice = adminProcedure
  .input(setImportPriceSchema)
  .mutation(async ({ input, ctx }) => {
    const {
      lwin18,
      importPricePerBottle,
      source,
      shipmentItemId,
      notes,
      ownerId,
      inTransit,
    } = input;

    if (source === 'manual' && !inTransit) {
      /*
        The same lot the Pricing Manager row reads: per owner, the newest lot
        on hand (a sold-out lot only when nothing is on hand).
      */
      const holders = await db
        .select({
          ownerId: wmsStock.ownerId,
          ownLine: sql<boolean | null>`(array_agg(ship.own_line ORDER BY (${wmsStock.quantityCases} > 0) DESC, ${wmsStock.receivedAt} DESC NULLS LAST))[1]`,
          productCost: sql<number | null>`(array_agg(ship.product_cost ORDER BY (${wmsStock.quantityCases} > 0) DESC, ${wmsStock.receivedAt} DESC NULLS LAST))[1]`,
          shipmentNumber: sql<string | null>`(
            SELECT ls.shipment_number FROM logistics_shipments ls
            WHERE ls.id = (array_agg(ship.shipment_id ORDER BY (${wmsStock.quantityCases} > 0) DESC, ${wmsStock.receivedAt} DESC NULLS LAST))[1]
          )`,
        })
        .from(wmsStock)
        .leftJoin(lotShipmentCost, sql`true`)
        .where(
          and(
            eq(wmsStock.lwin18, lwin18),
            gte(wmsStock.quantityCases, 0),
            ...(ownerId ? [eq(wmsStock.ownerId, ownerId)] : []),
          ),
        )
        .groupBy(wmsStock.ownerId);

      const invoiced = holders.filter(
        (h) => lotInvoiceCost({ ownLine: h.ownLine, productCost: h.productCost }) != null,
      );

      if (holders.length > 0 && invoiced.length === holders.length) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: invoicedImportMessage(invoiced[0]?.shipmentNumber),
        });
      }
    }

    const current = await db
      .select({ importPrice: wmsProductPricing.importPricePerBottle })
      .from(wmsProductPricing)
      .where(sql`${lwinPakKey(wmsProductPricing.lwin18)} = ${pakKeyOf(lwin18)}`);

    const recosted = current.some(
      (row) => row.importPrice !== importPricePerBottle,
    );

    const written = await writeProductPricing({
      lwin18,
      ownerId,
      set: {
        importPricePerBottle,
        importPriceSource: source,
        shipmentItemId: shipmentItemId ?? null,
        notes: notes ?? null,
        ...(recosted ? { pricingReleasedAt: null } : {}),
      },
      userId: ctx.user.id,
    });

    return { lwin18, importPricePerBottle, source, ownerOnly: written.ownerOnly };
  });

export default adminSetImportPrice;
