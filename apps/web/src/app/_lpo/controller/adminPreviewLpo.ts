import { TRPCError } from '@trpc/server';
import { and, eq, gt, inArray, sql } from 'drizzle-orm';
import pdfParse from 'pdf-parse';

import db from '@/database/client';
import {
  logisticsShipmentItems,
  logisticsShipments,
  wmsStock,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import INBOUND_SHIPMENT_STATUSES from '../../_wms/utils/inboundShipmentStatuses';
import previewLpoSchema from '../schemas/previewLpoSchema';
import matchLpoLine from '../utils/matchLpoLine';
import type { CatalogueCandidate } from '../utils/matchLpoLine';
import parseLpoText from '../utils/parseLpoText';

/** "75cl", "750ml", "1.5L" — however a row happens to spell its size. */
const toMl = (size: string | null) => {
  const match = String(size ?? '').match(/([\d.]+)\s*(cl|ml|l)/i);
  if (!match?.[1] || !match[2]) return null;

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();

  return unit === 'ml' ? value : unit === 'cl' ? value * 10 : value * 1000;
};

/**
 * Read a client's purchase order and say what it would take to fulfil it.
 *
 * Nothing is written. This exists so the answers arrive before the order does:
 * which wines they mean, whether we hold them, which lines are repacks, and
 * which item codes Zoho does not have yet. Today all four are found out one at
 * a time, the last of them at picking.
 *
 * Two rules decide what counts as available, and both were learnt the hard way:
 *
 * - **free bottles, not held ones.** `availableCases` is what is not already
 *   reserved for another order, and loose bottles from cracked cases
 *   (`openBottles`) are stock like any other.
 * - **for-sale stock only.** `notForSale` is a client's consignment held for
 *   its owner. Offering it back to a different client is the one error here
 *   that is not merely inconvenient.
 *
 * @param input - The purchase-order PDF
 * @returns The parsed order, its own reconciliation, and a verdict per line
 */
const adminPreviewLpo = adminProcedure
  .input(previewLpoSchema)
  .mutation(async ({ input }) => {
    const base64 = input.file.includes(',')
      ? (input.file.split(',')[1] ?? '')
      : input.file;

    const [parsed, parseError] = await (async () => {
      try {
        const text = (await pdfParse(Buffer.from(base64, 'base64'))).text;
        return [parseLpoText(text), null] as const;
      } catch (error) {
        return [null, error] as const;
      }
    })();

    if (!parsed || parseError) {
      logger.error('Could not read the purchase order PDF', { parseError });
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'That PDF could not be read as a purchase order',
      });
    }

    if (parsed.lines.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'No order lines were found. The layout may differ from the orders this reads.',
      });
    }

    const stockRows = await db
      .select({
        lwin18: wmsStock.lwin18,
        productName: sql<string>`MAX(${wmsStock.productName})`,
        producer: sql<string | null>`MAX(${wmsStock.producer})`,
        vintage: sql<number | null>`MAX(${wmsStock.vintage})`,
        bottleSize: sql<string | null>`MAX(${wmsStock.bottleSize})`,
        caseConfig: sql<number>`MAX(${wmsStock.caseConfig})::int`,
        // Free bottles: unreserved cases, plus the loose bottles of cracked ones.
        bottles: sql<number>`(
          SUM(${wmsStock.availableCases}) * MAX(${wmsStock.caseConfig})
          + SUM(${wmsStock.openBottles})
        )::int`,
      })
      .from(wmsStock)
      .where(eq(wmsStock.notForSale, false))
      .groupBy(wmsStock.lwin18);

    const inboundRows = await db
      .select({
        lwin18: sql<string>`COALESCE(MAX(${logisticsShipmentItems.lwin}), MAX(${logisticsShipmentItems.productName}))`,
        productName: sql<string>`MAX(${logisticsShipmentItems.productName})`,
        vintage: sql<number | null>`MAX(${logisticsShipmentItems.vintage})`,
        bottleSizeMl: sql<number | null>`MAX(${logisticsShipmentItems.bottleSizeMl})::int`,
        caseConfig: sql<number>`MAX(${logisticsShipmentItems.bottlesPerCase})::int`,
        bottles: sql<number>`COALESCE(
          SUM(${logisticsShipmentItems.totalBottles}),
          SUM(${logisticsShipmentItems.cases}) * MAX(${logisticsShipmentItems.bottlesPerCase})
        )::int`,
      })
      .from(logisticsShipmentItems)
      .innerJoin(
        logisticsShipments,
        eq(logisticsShipmentItems.shipmentId, logisticsShipments.id),
      )
      .where(
        and(
          inArray(logisticsShipments.status, [...INBOUND_SHIPMENT_STATUSES]),
          // The line's own answer wins over the shipment's, as `_logistics`
          // defines it — that is how part of a consignment is sold.
          sql`COALESCE(${logisticsShipmentItems.notForSale}, ${logisticsShipments.notForSale}) = false`,
          gt(logisticsShipmentItems.cases, 0),
        ),
      )
      .groupBy(logisticsShipmentItems.lwin, logisticsShipmentItems.productName);

    const candidates: CatalogueCandidate[] = [
      ...stockRows.map((row) => ({
        lwin18: row.lwin18,
        wine: (row.productName ?? '').trim(),
        producer: row.producer,
        vintage: row.vintage == null ? 'NV' : String(row.vintage),
        sizeMl: toMl(row.bottleSize) ?? 750,
        pack: row.caseConfig || 1,
        bottles: Math.max(0, row.bottles ?? 0),
        source: 'stock' as const,
      })),
      ...inboundRows.map((row) => ({
        lwin18: row.lwin18,
        wine: (row.productName ?? '').trim(),
        producer: null,
        vintage: row.vintage == null ? 'NV' : String(row.vintage),
        sizeMl: row.bottleSizeMl ?? 750,
        pack: row.caseConfig || 1,
        bottles: Math.max(0, row.bottles ?? 0),
        source: 'inbound' as const,
      })),
    ];

    const lines = parsed.lines.map((line) => {
      const match = matchLpoLine({
        wine: line.wine,
        vintage: line.vintage,
        sizeMl: line.sizeMl,
        bottles: line.bottles,
        candidates,
      });

      const shortfall = match.lwin18
        ? Math.max(0, line.bottles - match.availableBottles)
        : 0;

      /*
        The pack the sale needs. A client taking three bottles of a six is a
        three-pack sale, and that code may not exist in Zoho — which is the
        manual step this whole screen is here to remove.
      */
      const heldPack = match.rows[0]?.pack ?? line.bottles;
      const soldPack =
        line.bottles % heldPack === 0 ? heldPack : line.bottles;

      return {
        ...line,
        match,
        shortfall,
        soldPack,
        isRepack: match.lwin18 !== null && soldPack !== heldPack,
      };
    });

    return {
      order: {
        poNumber: parsed.poNumber,
        poDate: parsed.poDate,
        client: parsed.client,
        creditTerms: parsed.creditTerms,
        fileName: input.fileName ?? null,
      },
      reconciliation: {
        lineCount: parsed.lines.length,
        totalBottles: parsed.totalBottles,
        computedTotalAed: parsed.computedTotalAed,
        declaredTotalAed: parsed.declaredTotalAed,
        agrees:
          parsed.declaredTotalAed !== null &&
          Math.abs(parsed.computedTotalAed - parsed.declaredTotalAed) < 0.5,
        skipped: parsed.skipped,
        disputedLines: parsed.lines.filter((line) => line.problem !== null)
          .length,
      },
      lines,
      summary: {
        matched: lines.filter((line) => line.match.lwin18).length,
        unmatched: lines.filter((line) => !line.match.lwin18).length,
        shortLines: lines.filter((line) => line.shortfall > 0).length,
        repackLines: lines.filter((line) => line.isRepack).length,
        lastBottleLines: lines.filter((line) => line.match.takesLastBottles)
          .length,
      },
    };
  });

export default adminPreviewLpo;
