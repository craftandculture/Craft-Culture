import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsShipmentItems, logisticsShipments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import importExtractedItemsSchema from '../schemas/importExtractedItemsSchema';
import priceShipmentInUsd from '../utils/priceShipmentInUsd';
import toMenuHsCode from '../utils/toMenuHsCode';
import toValidLwin from '../utils/toValidLwin';

/**
 * Import extracted line items from a document into a shipment
 *
 * Takes extracted data from the document extraction tool and creates
 * shipment items from the line items.
 */
const adminImportExtractedItems = adminProcedure
  .input(importExtractedItemsSchema)
  .mutation(async ({ input }) => {
    const { shipmentId, items, cargoSummary, declared, overwriteCargoData } = input;
    const documentCurrency = input.currency.toUpperCase();

    logger.info('[ImportExtractedItems] Starting import:', {
      shipmentId,
      itemCount: items.length,
      hasCargoSummary: !!cargoSummary,
    });

    // Verify shipment exists using select instead of query API to avoid relation issues
    const [shipment] = await db
      .select()
      .from(logisticsShipments)
      .where(eq(logisticsShipments.id, shipmentId))
      .limit(1);

    if (!shipment) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Shipment not found',
      });
    }

    /*
      The document's own totals, recorded whether or not they agree with ours.

      Written before the items so they survive an import that half-succeeds —
      the disagreement is most useful precisely when something went wrong. The
      confirmation is deliberately cleared: figures that have changed have not
      been checked by anyone, whatever was accepted last time.
    */
    {
      await db
        .update(logisticsShipments)
        .set({
          /*
            What the shipment is billed in, stamped on the way in.

            It was only ever written by the conversion step, which runs solely
            for non-USD documents — so a shipment imported as USD carried no
            statement of its currency at all, and the screen that offers to
            price a foreign invoice had nothing to trigger on.
          */
          sourceCurrency: documentCurrency,
          declaredCases: declared?.cases ?? null,
          declaredBottles: declared?.bottles ?? null,
          declaredCartons: declared?.cartons ?? null,
          declaredPallets: declared?.pallets ?? null,
          declaredValue: declared?.value ?? null,
          declaredCurrency: declared?.value != null ? documentCurrency : null,
          declaredSource: declared?.source ?? null,
          declaredConfirmedAt: null,
          declaredConfirmedBy: null,
        })
        .where(eq(logisticsShipments.id, shipmentId));
    }

    // Update shipment cargo summary if provided
    if (cargoSummary) {
      const updateData: Partial<typeof logisticsShipments.$inferInsert> = {};

      // Only update fields that are provided AND (either overwrite is true OR existing value is null)
      if (cargoSummary.totalCases !== undefined) {
        if (overwriteCargoData || shipment.totalCases === null || shipment.totalCases === 0) {
          updateData.totalCases = cargoSummary.totalCases;
        }
      }
      if (cargoSummary.totalPallets !== undefined) {
        if (overwriteCargoData || shipment.totalPallets === null) {
          updateData.totalPallets = cargoSummary.totalPallets;
        }
      }
      if (cargoSummary.totalWeight !== undefined) {
        if (overwriteCargoData || shipment.totalWeightKg === null) {
          updateData.totalWeightKg = cargoSummary.totalWeight;
        }
      }
      if (cargoSummary.totalVolume !== undefined) {
        if (overwriteCargoData || shipment.totalVolumeM3 === null) {
          updateData.totalVolumeM3 = cargoSummary.totalVolume;
        }
      }

      if (Object.keys(updateData).length > 0) {
        await db
          .update(logisticsShipments)
          .set(updateData)
          .where(eq(logisticsShipments.id, shipmentId));

        logger.info('[ImportExtractedItems] Updated shipment cargo data:', {
          shipmentId,
          updatedFields: Object.keys(updateData),
        });
      }
    }

    // Get current max sort order for this shipment
    const existingItems = await db
      .select({ sortOrder: logisticsShipmentItems.sortOrder })
      .from(logisticsShipmentItems)
      .where(eq(logisticsShipmentItems.shipmentId, shipmentId));

    let maxSortOrder = 0;
    for (const item of existingItems) {
      if (item.sortOrder && item.sortOrder > maxSortOrder) {
        maxSortOrder = item.sortOrder;
      }
    }

    // Create shipment items from extracted data
    const createdItems = [];
    let sortOrder = maxSortOrder;

    for (const item of items) {
      // Use productName or description as the product name
      const productName = item.productName || item.description;

      if (!productName) {
        logger.warn('[ImportExtractedItems] Skipping item without name:', { item });
        continue;
      }

      // What the document counts in decides everything downstream, so it is
      // read rather than assumed. A bottle count is taken as given; where the
      // document prints total litres it proves itself, since total ÷ size is
      // the bottle count and disagreement means the line was misread.
      const statedBottles = item.bottles ?? null;
      const impliedBottles =
        item.productSizeL && item.totalSizeL && item.productSizeL > 0
          ? Math.round(item.totalSizeL / item.productSizeL)
          : null;

      // Parse bottle size from string like "750ml" or "1.5L" to integer ml
      let bottleSizeMl = 750; // Default
      if (item.bottleSize) {
        const sizeStr = item.bottleSize.toLowerCase();
        if (sizeStr.includes('ml')) {
          bottleSizeMl = parseInt(sizeStr.replace(/[^0-9]/g, ''), 10) || 750;
        } else if (sizeStr.includes('l')) {
          const liters = parseFloat(sizeStr.replace(/[^0-9.]/g, ''));
          bottleSizeMl = Math.round(liters * 1000) || 750;
        }
      }

      /**
       * The pack is only ever what the document said it was.
       *
       * This used to fall back to 12, which is invisible and wrong on any
       * invoice that does not state a pack — and a supplier shipping 464
       * bottles as 97 mixed cases cannot state one per line. Every figure
       * built on an invented pack is wrong by a factor nobody chose.
       *
       * Unknown is recorded as 1, so cases × pack still equals the bottles
       * that were actually billed. The real pack arrives with the LWIN, which
       * carries it in its own digits.
       */
      const packFromDocument =
        item.bottlesPerCase && item.bottlesPerCase > 0
          ? item.bottlesPerCase
          : null;

      const totalBottles =
        statedBottles ??
        impliedBottles ??
        (item.cases != null ? item.cases * (packFromDocument ?? 1) : null) ??
        0;

      /**
       * A bottle-billed line is one pack of that many bottles.
       *
       * The supplier ships six bottles of a wine boxed together, so that is
       * how it is received and how it clears customs — 1 × 6, not 6 × 1. It is
       * also the shape someone correcting these by hand arrives at: every line
       * fixed manually on this shipment came out as one case of the billed
       * quantity.
       */
      const statedCases = item.cases ?? null;

      /*
        Where the document states both, they have to agree, and when they do
        not the bottle count is the one that was billed. This invoice bills two
        bottles of a wine whose pack is printed as six: honouring the pack
        would store six, three times what was paid for. So a pack that cannot
        be reconciled is dropped rather than trusted, and the line becomes one
        case of what was actually billed — the same shape as every line
        corrected by hand on this shipment.
      */
      const packAgrees =
        packFromDocument != null &&
        totalBottles > 0 &&
        totalBottles % packFromDocument === 0 &&
        (statedCases == null || statedCases * packFromDocument === totalBottles);

      /**
       * A case is the packaging bottles travel in, so it counts BOXES.
       *
       * Where a document bills loose bottles out of a pack — Wilkinson's "bt"
       * column against their "cs" — those bottles carry no case of their own:
       * several such lines are consolidated into one mixed carton, and only
       * the document knows how many. Recording one case per line invented six
       * cartons on a fourteen-line invoice and made the shipment
       * irreconcilable with its own "12 cases on 1 pallet".
       *
       * So a bottle-billed line stores 0 cases and keeps the REAL pack it came
       * out of — 3 bottles of a twelve, not a three-bottle case that does not
       * exist. Physical cartons are declared on the shipment, never summed
       * from the lines.
       */
      const bottleBilled =
        (statedCases == null || statedCases === 0) &&
        statedBottles != null &&
        statedBottles > 0;

      const bottlesPerCase = bottleBilled
        ? (packFromDocument ?? 1)
        : packAgrees
          ? (packFromDocument as number)
          : totalBottles > 0
            ? totalBottles
            : 1;

      const cases = bottleBilled
        ? 0
        : packAgrees
          ? (statedCases ?? totalBottles / (packFromDocument as number))
          : 1;

      // Prices stay in the currency they were billed in. Converting here was
      // how a rate of roughly 1.1666 came to be applied to a euro invoice with
      // nothing recording that it had happened, or at what rate. The shipment
      // is priced in USD later, once, at a rate someone chose.
      const sourceCurrency = documentCurrency;

      // The line total divided by its bottles is the one unambiguous reading.
      // A price column can be per case or per bottle and the document rarely
      // says which — Wilkinson head theirs "Price/Case" and the extractor took
      // £3,960 as the price of one Opus One, which is the price of twelve.
      //
      // unitPriceBasis is only trusted when there is no total to check against;
      // nothing has ever populated it, so it cannot be relied on alone.
      const fromTotal =
        item.total && totalBottles ? item.total / totalBottles : undefined;

      const fromUnit =
        item.unitPriceBasis === 'case' && item.unitPrice && bottlesPerCase > 0
          ? item.unitPrice / bottlesPerCase
          : item.unitPrice;

      const sourceUnitPrice = fromTotal ?? fromUnit;

      const sourceTotal =
        item.total ??
        (sourceUnitPrice != null && totalBottles
          ? sourceUnitPrice * totalBottles
          : undefined);

      sortOrder += 1;

      const [newItem] = await db
        .insert(logisticsShipmentItems)
        .values({
          shipmentId,
          productName,
          // Only a complete LWIN is kept. The extractor takes whatever sits
          // in the column it was told to read, and on an invoice with no
          // product code that was an account number written to every line —
          // nine different wines all showing as matched to 121084.
          lwin: toValidLwin(item.lwin),
          supplierSku: item.supplierSku,
          producer: item.producer,
          vintage: item.vintage,
          region: item.region,
          cases: Math.max(0, Math.round(cases)),
          bottlesPerCase,
          bottleSizeMl,
          totalBottles: Math.round(totalBottles),
          // The invoice carries national subheadings — 2204214290 and its
          // like. We declare on the codes in the HS menu, so a line lands on
          // one of those rather than bringing a fresh subheading in with every
          // import.
          hsCode: toMenuHsCode(item.hsCode),
          countryOfOrigin: item.countryOfOrigin,
          grossWeightKg: item.weight,
          sourceCurrency,
          sourceUnitPrice,
          sourceTotal,
          // Left unpriced until a rate is set, rather than quietly labelling
          // euros as dollars.
          declaredValueUsd: sourceCurrency === 'USD' ? sourceTotal : null,
          productCostPerBottle:
            sourceCurrency === 'USD' ? sourceUnitPrice : null,
          sortOrder,
        })
        .returning();

      if (newItem) {
        createdItems.push(newItem);
      }
    }

    /*
      Priced immediately, at today's rate, rather than left blank.

      Leaving 165 lines unpriced to avoid an unrecorded conversion solved the
      wrong half of the problem: it protected the figures by making them
      absent, which still leaves someone converting a euro invoice by hand.
      The conversion is safe because it is recorded — rate, source and date sit
      on the shipment — and because it always recomputes from what the document
      stated, so entering the rate actually agreed with the supplier afterwards
      corrects these figures rather than compounding them.
    */
    let pricing = null;

    if (createdItems.length > 0 && documentCurrency !== 'USD') {
      pricing = await priceShipmentInUsd(shipmentId, { currency: documentCurrency });

      if (pricing.rateSource === 'unresolved') {
        logger.warn('[ImportExtractedItems] No rate found, goods left unpriced:', {
          shipmentId,
          currency: documentCurrency,
        });
      }
    }

    logger.info('[ImportExtractedItems] Import complete:', {
      shipmentId,
      itemsImported: createdItems.length,
      itemsSkipped: items.length - createdItems.length,
      cargoSummaryUpdated: !!cargoSummary,
    });

    return {
      success: true,
      itemsImported: createdItems.length,
      itemsSkipped: items.length - createdItems.length,
      items: createdItems,
      cargoSummaryUpdated: !!cargoSummary,
      pricing,
    };
  });

export default adminImportExtractedItems;
