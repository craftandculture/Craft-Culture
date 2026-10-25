import { and, desc, eq, gt, gte, inArray, lt, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import getOwnerDeliveryOwners from '@/app/_cellar/data/getOwnerDeliveryOwners';
import STOCK_OUT_REASONS from '@/app/_wms/constants/stockOutReasons';
import getOwnerWineCosts from '@/app/_wms/data/getOwnerWineCosts';
import displayWineName from '@/app/_wms/utils/displayWineName';
import { lwinPakKeyOf } from '@/app/_wms/utils/lwinPakKey';
import db from '@/database/client';
import {
  cellarPurchases,
  cellarReleaseRequestItems,
  cellarReleaseRequests,
  cellarUkHoldings,
  cellarUkRotations,
  consignmentSettlements,
  lwinWines,
  poolSales,
  privateClientOrders,
  saleMandates,
  wmsStock,
  wmsStockMovements,
  wmsStockOutflows,
  zohoSalesOrders,
} from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';


import bottleName from '../utils/bottleName';

/** The UAE is four hours ahead of UTC all year, so a month starts at 20:00 UTC the day before */
const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;

/** Bottles per case from a dashed LWIN18 (`1010279-2015-06-00750` → 6) */
const packOf = (lwin18: string) => {
  const pack = Number(lwin18.split('-')[2]);

  return Number.isFinite(pack) && pack > 0 ? pack : 1;
};

/**
 * A movement's wine as a collector reads it: the name alone, then vintage and
 * bottle from the code. Movement names are the receiving clerk's string —
 * "Domaine Anne Gros Vosne-Romanee 2023 0.75L 13.5%abv" — and printed as they
 * stand they made the statement look like a stock report.
 */
const wineLine = (productName: string, lwin18: string) => {
  const [, year, , size] = lwin18.split('-');
  // The LWIN size field is millilitres: 00750 is a 75cl bottle
  const ml = Number(size);
  const detail = [
    year && /^(19|20)\d{2}$/.test(year) ? year : null,
    ml > 0 ? bottleName(`${ml / 10}cl`) : null,
  ].filter(Boolean);

  return { name: displayWineName(productName), detail: detail.join(' · ') };
};

/**
 * A member's statement for one calendar month
 *
 * What came into the cellar, what left it, what sold and what was paid, plus
 * the wine held. Built from the records each event already writes, so it needs
 * no table of its own:
 *
 * - **Arrived**: WMS receive movements. Recorded against the owner from
 *   2026-10-18; earlier ones are matched through the shipment they came in on.
 * - **Bought / added**: WMS ownership transfers into the member.
 * - **Delivered**: delivery requests whose order was delivered in the month.
 * - **Sold**: pool sales, at the member's asking price.
 * - **Paid to you**: settlements a monthly payment was issued for in the month.
 * - **UK arrivals**: LCB rotations placed with the member, by LCB's received date.
 * - **Left your cellar**: bottles of theirs picked for an order (other than a
 *   delivery to them), taken out of stock, or lost in a count. Picks record
 *   the owner from 24 Oct 2026; earlier ones were stamped from the bay they
 *   left where only one owner held that wine there (Index 3.0).
 *
 * Holdings are as they stand today, not at month end.
 *
 * No fees, rates or values: an active member is never shown what we charge.
 *
 * @example
 *   const statement = await trpcClient.cellar.member.getStatement.query({
 *     month: '2026-09',
 *   });
 */
const memberGetStatement = stockOwnerProcedure
  .input(
    z.object({
      /** Calendar month, `YYYY-MM` */
      month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    }),
  )
  .query(async ({ ctx, input }) => {
    const partnerId = ctx.partner.id;
    const [year, month] = input.month.split('-').map(Number) as [number, number];

    const from = new Date(Date.UTC(year, month - 1, 1) - DUBAI_OFFSET_MS);
    const to = new Date(Date.UTC(year, month, 1) - DUBAI_OFFSET_MS);

    const inMonth = (column: Parameters<typeof gte>[0]) =>
      and(gte(column, from), lt(column, to));

    const [arrivals, transfersIn, delivered, sold, paid, holdings] =
      await Promise.all([
        /*
          Receipts into the C&C warehouse. A movement written before the owner
          was recorded on it is attributed through its shipment: the line's
          own owner where one was set, otherwise the shipment's.
        */
        db
          .select({
            id: wmsStockMovements.id,
            lwin18: wmsStockMovements.lwin18,
            productName: wmsStockMovements.productName,
            quantityCases: wmsStockMovements.quantityCases,
            quantityBottles: wmsStockMovements.quantityBottles,
            at: wmsStockMovements.performedAt,
          })
          .from(wmsStockMovements)
          .where(
            and(
              eq(wmsStockMovements.movementType, 'receive'),
              inMonth(wmsStockMovements.performedAt),
              sql`(
                ${wmsStockMovements.toOwnerId} = ${partnerId}
                OR (
                  ${wmsStockMovements.toOwnerId} IS NULL
                  AND ${wmsStockMovements.shipmentId} IS NOT NULL
                  AND EXISTS (
                    SELECT 1
                    FROM logistics_shipment_items i
                    JOIN logistics_shipments s ON s.id = i.shipment_id
                    WHERE i.shipment_id = ${wmsStockMovements.shipmentId}
                      AND COALESCE(i.override_owner_id, s.partner_id) = ${partnerId}
                      AND (
                        i.product_name = ${wmsStockMovements.productName}
                        OR (
                          length(replace(coalesce(i.lwin, ''), '-', '')) >= 7
                          AND replace(${wmsStockMovements.lwin18}, '-', '')
                            LIKE replace(i.lwin, '-', '') || '%'
                        )
                      )
                  )
                )
              )`,
            ),
          )
          .orderBy(wmsStockMovements.performedAt),

        db
          .select({
            id: wmsStockMovements.id,
            lwin18: wmsStockMovements.lwin18,
            productName: wmsStockMovements.productName,
            quantityCases: wmsStockMovements.quantityCases,
            quantityBottles: wmsStockMovements.quantityBottles,
            reasonCode: wmsStockMovements.reasonCode,
            orderId: wmsStockMovements.orderId,
            at: wmsStockMovements.performedAt,
          })
          .from(wmsStockMovements)
          .where(
            and(
              eq(wmsStockMovements.movementType, 'ownership_transfer'),
              eq(wmsStockMovements.toOwnerId, partnerId),
              inMonth(wmsStockMovements.performedAt),
            ),
          )
          .orderBy(wmsStockMovements.performedAt),

        db
          .select({
            requestId: cellarReleaseRequests.id,
            deliveredAt: privateClientOrders.deliveredAt,
            productName: cellarReleaseRequestItems.productName,
            vintage: cellarReleaseRequestItems.vintage,
            bottles: cellarReleaseRequestItems.bottles,
          })
          .from(cellarReleaseRequests)
          .innerJoin(
            privateClientOrders,
            eq(cellarReleaseRequests.privateClientOrderId, privateClientOrders.id),
          )
          .innerJoin(
            cellarReleaseRequestItems,
            eq(cellarReleaseRequestItems.requestId, cellarReleaseRequests.id),
          )
          .where(
            and(
              eq(cellarReleaseRequests.partnerId, partnerId),
              eq(privateClientOrders.status, 'delivered'),
              inMonth(privateClientOrders.deliveredAt),
            ),
          )
          .orderBy(privateClientOrders.deliveredAt),

        db
          .select({
            id: poolSales.id,
            productName: poolSales.productName,
            bottles: poolSales.bottles,
            amountUsd: poolSales.owedToOwnerUsd,
            at: poolSales.soldAt,
          })
          .from(poolSales)
          .where(and(eq(poolSales.ownerId, partnerId), inMonth(poolSales.soldAt)))
          .orderBy(poolSales.soldAt),

        db
          .select({
            amountUsd: consignmentSettlements.owedToOwner,
            at: consignmentSettlements.settledAt,
          })
          .from(consignmentSettlements)
          .where(
            and(
              eq(consignmentSettlements.ownerId, partnerId),
              eq(consignmentSettlements.status, 'settled'),
              inMonth(consignmentSettlements.settledAt),
            ),
          ),

        db
          .select({
            lwin18: wmsStock.lwin18,
            productName: wmsStock.productName,
            producer: wmsStock.producer,
            vintage: wmsStock.vintage,
            bottleSize: wmsStock.bottleSize,
            caseConfig: wmsStock.caseConfig,
            cases: sql<number>`SUM(${wmsStock.quantityCases})::int`,
          })
          .from(wmsStock)
          .where(and(eq(wmsStock.ownerId, partnerId), gt(wmsStock.quantityCases, 0)))
          .groupBy(
            wmsStock.lwin18,
            wmsStock.productName,
            wmsStock.producer,
            wmsStock.vintage,
            wmsStock.bottleSize,
            wmsStock.caseConfig,
          )
          .orderBy(wmsStock.productName),
      ]);

    /*
      What left the member's stock this month, other than deliveries to them
      (listed under Delivered). A collector may see where it went, so the
      customer and order are named (trade partners never are: see
      partnerMovementDetail).
    */
    // Up to the end of this month; from its start for the month's lines, from the beginning for what is owed
    const readLeft = (since: Date | null) =>
      db
      .select({
        id: wmsStockMovements.id,
        movementType: wmsStockMovements.movementType,
        reasonCode: wmsStockMovements.reasonCode,
        lwin18: wmsStockMovements.lwin18,
        productName: wmsStockMovements.productName,
        quantityCases: wmsStockMovements.quantityCases,
        quantityBottles: wmsStockMovements.quantityBottles,
        at: wmsStockMovements.performedAt,
        salesOrderNumber: zohoSalesOrders.salesOrderNumber,
        customerName: zohoSalesOrders.customerName,
        pcoNumber: privateClientOrders.orderNumber,
        orderId: wmsStockMovements.orderId,
        unitPriceUsd: wmsStockOutflows.unitPriceUsd,
      })
      .from(wmsStockMovements)
      .leftJoin(zohoSalesOrders, eq(wmsStockMovements.orderId, zohoSalesOrders.id))
      .leftJoin(privateClientOrders, eq(wmsStockMovements.orderId, privateClientOrders.id))
      .leftJoin(wmsStockOutflows, eq(wmsStockOutflows.movementId, wmsStockMovements.id))
      .where(
        and(
          eq(wmsStockMovements.fromOwnerId, partnerId),
          since ? gte(wmsStockMovements.performedAt, since) : undefined,
          lt(wmsStockMovements.performedAt, to),
          or(
            eq(wmsStockMovements.movementType, 'pick'),
            and(
              eq(wmsStockMovements.movementType, 'adjust'),
              sql`${wmsStockMovements.reasonCode} LIKE 'stock_out:%'`,
            ),
            and(eq(wmsStockMovements.movementType, 'count'), lt(wmsStockMovements.quantityCases, 0)),
          ),
        ),
      )
      .orderBy(wmsStockMovements.performedAt);

    const [leftRows, leftToDate, mandates, costs, [paidToDate], [poolToDate]] = await Promise.all([
      readLeft(from),
      readLeft(null),
      db
        .select({ lwinKey: saleMandates.lwinKey, ask: saleMandates.askPerBottleUsd })
        .from(saleMandates)
        .where(
          and(
            eq(saleMandates.ownerId, partnerId),
            inArray(saleMandates.status, ['offered', 'listed', 'placed', 'partially_sold', 'sold']),
          ),
        ),
      getOwnerWineCosts(partnerId),
      db
        .select({ total: sql<number>`COALESCE(SUM(${consignmentSettlements.owedToOwner}), 0)::float` })
        .from(consignmentSettlements)
        .where(
          and(
            eq(consignmentSettlements.ownerId, partnerId),
            eq(consignmentSettlements.status, 'settled'),
            lt(consignmentSettlements.settledAt, to),
          ),
        ),
      db
        .select({ total: sql<number>`COALESCE(SUM(${poolSales.owedToOwnerUsd}), 0)::float` })
        .from(poolSales)
        .where(and(eq(poolSales.ownerId, partnerId), lt(poolSales.soldAt, to))),
    ]);

    /*
      What each bottle that left is worth to the owner. A sale is valued at
      the owner's own price for that wine (their Selling offer, or the price
      agreed with C&C and recorded there). Samples and damage are at what the
      bottle cost them to land. Deliveries, collections and count corrections
      carry no money. No price yet means null: shown as "price being agreed",
      never as $0.
    */
    const askByKey = new Map(mandates.map((row) => [row.lwinKey, row.ask]));
    const valueOf = (row: (typeof leftRows)[number], bottles: number, isOwnDelivery: boolean) => {
      if (isOwnDelivery || row.movementType === 'count') return null;
      if (row.reasonCode?.startsWith('stock_out:')) {
        const rule = STOCK_OUT_REASONS[row.reasonCode.slice('stock_out:'.length) as keyof typeof STOCK_OUT_REASONS];
        if (rule?.settlement === 'price') return row.unitPriceUsd != null ? bottles * row.unitPriceUsd : null;
        if (rule?.settlement === 'cc_landed' || rule?.settlement === 'owner_reimbursed') {
          const landed = costs.get(lwinPakKeyOf(row.lwin18))?.landedPerBottle;
          return landed != null ? bottles * landed : null;
        }
        return null;
      }
      const ask = askByKey.get(lwinPakKeyOf(row.lwin18));
      return ask != null ? bottles * ask : null;
    };

    /*
      The member's own deliveries, whether picked as the delivery order or as
      a Zoho order referencing it. Once delivered this month they are listed
      under Delivered, so are not listed twice; until then they are on their
      way to the member, not sold.
    */
    const ownDeliveries = await getOwnerDeliveryOwners(leftToDate.map((row) => row.orderId));
    const deliveryOf = (row: (typeof leftRows)[number]) => {
      const delivery = row.orderId ? ownDeliveries.get(row.orderId) : undefined;
      return delivery?.ownerId === partnerId ? delivery : undefined;
    };
    const bottlesOfLeft = (row: (typeof leftRows)[number]) =>
      Math.abs(row.quantityBottles ?? row.quantityCases * packOf(row.lwin18));
    const amountOf = (row: (typeof leftRows)[number]) => {
      const value = valueOf(row, bottlesOfLeft(row), !!deliveryOf(row));
      return value != null ? Math.round(value * 100) / 100 : null;
    };

    const leftShown = leftRows.filter((row) => {
      const delivery = deliveryOf(row);
      return !(
        delivery?.status === 'delivered' &&
        delivery.deliveredAt &&
        delivery.deliveredAt >= from &&
        delivery.deliveredAt < to
      );
    });

    const leftNote = (row: (typeof leftRows)[number]) => {
      const delivery = deliveryOf(row);
      if (delivery) return `Your delivery · ${delivery.pcoNumber}`;
      if (row.reasonCode?.startsWith('stock_out:')) {
        const reason = row.reasonCode.slice('stock_out:'.length) as keyof typeof STOCK_OUT_REASONS;
        return STOCK_OUT_REASONS[reason]?.ownerSees ?? 'Taken out of stock';
      }
      if (row.movementType === 'count') return 'Stock count adjustment';
      // Only a collector is told who took it: trade partners never see counterparties
      if (ctx.partner.type !== 'private_collector') return 'Left the warehouse on an order';
      if (row.salesOrderNumber) {
        return `Went to ${row.customerName ?? 'a customer'} · ${row.salesOrderNumber}`;
      }
      if (row.pcoNumber) return `Private client order · ${row.pcoNumber}`;
      return 'Left the warehouse on an order';
    };

    /*
      What became of each bottle, and the order it went on, so the page can
      show one line per order (a delivery, a sale to one buyer) that opens to
      the wines, instead of every wine in a single long list.
    */
    const isCollector = ctx.partner.type === 'private_collector';
    const leftOutcome = (row: (typeof leftRows)[number]) => {
      const delivery = deliveryOf(row);
      if (delivery) {
        return {
          outcome: 'delivery' as const,
          groupKey: `delivery:${delivery.pcoNumber}`,
          groupLabel: `Your delivery · ${delivery.pcoNumber}`,
          status: delivery.status === 'delivered' ? 'Delivered' : 'On its way',
        };
      }
      if (row.reasonCode?.startsWith('stock_out:')) {
        const reason = row.reasonCode.slice('stock_out:'.length) as keyof typeof STOCK_OUT_REASONS;
        const rule = STOCK_OUT_REASONS[reason];
        if (rule?.settlement === 'cc_landed') {
          return { outcome: 'sale' as const, groupKey: 'sale:cc', groupLabel: 'Sold to Craft & Culture · samples and tastings', status: null };
        }
        if (rule?.settlement === 'price') {
          return { outcome: 'sale' as const, groupKey: 'sale:direct', groupLabel: 'Sold', status: null };
        }
        if (rule?.settlement === 'owner_reimbursed') {
          return { outcome: 'reimbursed' as const, groupKey: `reimbursed:${reason}`, groupLabel: rule.ownerSees, status: null };
        }
        return { outcome: 'collected' as const, groupKey: `collected:${reason}`, groupLabel: rule?.ownerSees ?? 'Taken out of stock', status: null };
      }
      if (row.movementType === 'count') {
        return { outcome: 'adjustment' as const, groupKey: 'adjustment', groupLabel: 'Stock count adjustment', status: null };
      }
      const order = row.salesOrderNumber ?? row.pcoNumber ?? 'order';
      // Only a collector is told who bought it: trade partners never see counterparties
      const buyer = isCollector
        ? row.salesOrderNumber
          ? (row.customerName ?? 'a buyer')
          : 'a private client'
        : null;
      return {
        outcome: 'sale' as const,
        groupKey: `sale:${order}`,
        groupLabel: buyer ? `Sold to ${buyer} · ${order}` : `Sold · order ${order}`,
        status: null,
      };
    };

    /*
      UK wine, guarded: the tables are new, and a missed migration should cost
      the statement its UK lines rather than the whole page.
    */
    let ukHoldings: {
      name: string;
      vintage: number | null;
      bottlesPerCase: number | null;
      totalBottles: number;
      receivedAt: Date | null;
    }[] = [];
    let ukReportedAt: Date | null = null;

    try {
      const rows = await db
        .select({
          lwin18: cellarUkHoldings.lwin18,
          brand: cellarUkHoldings.brand,
          description: cellarUkHoldings.description,
          vintage: cellarUkHoldings.vintage,
          bottlesPerCase: cellarUkHoldings.bottlesPerCase,
          totalBottles: cellarUkHoldings.totalBottles,
          receivedAt: cellarUkHoldings.receivedAt,
          reportedAt: cellarUkHoldings.createdAt,
        })
        .from(cellarUkHoldings)
        .innerJoin(
          cellarUkRotations,
          eq(cellarUkHoldings.rotation, cellarUkRotations.rotation),
        )
        .where(eq(cellarUkRotations.partnerId, partnerId))
        .orderBy(desc(cellarUkHoldings.receivedAt));

      const lwin7s = [
        ...new Set(
          rows
            .map((row) => row.lwin18.slice(0, 7))
            .filter((code) => /^\d{7}$/.test(code)),
        ),
      ];

      const names = lwin7s.length
        ? await db
            .select({ lwin: lwinWines.lwin, displayName: lwinWines.displayName })
            .from(lwinWines)
            .where(inArray(lwinWines.lwin, lwin7s))
        : [];

      const nameByLwin = new Map(names.map((row) => [row.lwin, row.displayName]));

      /*
        One line per wine: LCB books every case as its own rotation, and a
        statement listing the same Cervaro five times reads as five wines.
      */
      const byWine = new Map<string, (typeof ukHoldings)[number]>();
      for (const row of rows) {
        const name =
          nameByLwin.get(row.lwin18.slice(0, 7)) ??
          (row.brand && row.brand !== 'NA' ? row.brand : row.description) ??
          'Wine';
        const key = `${row.lwin18}|${name}`;
        const existing = byWine.get(key);
        if (existing) {
          existing.totalBottles += row.totalBottles;
          if (row.receivedAt && (!existing.receivedAt || row.receivedAt < existing.receivedAt)) {
            existing.receivedAt = row.receivedAt;
          }
        } else {
          byWine.set(key, {
            name,
            vintage: row.vintage,
            bottlesPerCase: row.bottlesPerCase,
            totalBottles: row.totalBottles,
            receivedAt: row.receivedAt,
          });
        }
      }
      ukHoldings = [...byWine.values()];
      ukReportedAt = rows[0]?.reportedAt ?? null;
    } catch (error) {
      logger.error('Could not read UK wine for a statement', { partnerId, error });
    }

    const bottlesOf = (row: {
      lwin18: string;
      quantityCases: number;
      quantityBottles: number | null;
    }) => row.quantityBottles ?? row.quantityCases * packOf(row.lwin18);

    const deliveries = new Map<
      string,
      {
        deliveredAt: Date | null;
        wines: { name: string; detail: string; bottles: number }[];
      }
    >();

    for (const row of delivered) {
      const entry = deliveries.get(row.requestId) ?? {
        deliveredAt: row.deliveredAt,
        wines: [],
      };
      entry.wines.push({
        name: displayWineName(row.productName),
        detail: row.vintage ? String(row.vintage) : '',
        bottles: row.bottles,
      });
      deliveries.set(row.requestId, entry);
    }

    const round = (value: number) => Math.round(value * 100) / 100;

    const ukArrived = ukHoldings.filter(
      (row) => row.receivedAt && row.receivedAt >= from && row.receivedAt < to,
    );

    /*
      A purchase reversed after the wine changed hands still has its transfer
      in on record, followed by the transfer back out. Listing it as bought
      showed wine the member never kept, so purchases that did not stand are
      left out.
    */
    const purchaseIds = [
      ...new Set(
        transfersIn
          .filter((row) => row.reasonCode === 'pool_sale' && row.orderId)
          .map((row) => row.orderId as string),
      ),
    ];

    const reversedPurchaseIds = new Set(
      purchaseIds.length
        ? (
            await db
              .select({ id: cellarPurchases.id })
              .from(cellarPurchases)
              .where(
                and(
                  inArray(cellarPurchases.id, purchaseIds),
                  eq(cellarPurchases.status, 'cancelled'),
                ),
              )
          ).map((row) => row.id)
        : [],
    );

    return {
      month: input.month,
      periodStart: from,
      periodEnd: to,
      generatedAt: new Date(),
      memberName: ctx.partner.businessName,

      added: [
        ...arrivals.map((row) => ({
          id: row.id,
          kind: 'arrived' as const,
          at: row.at,
          ...wineLine(row.productName, row.lwin18),
          bottles: bottlesOf(row),
          where: 'uae' as const,
        })),
        ...transfersIn
          .filter((row) => !(row.orderId && reversedPurchaseIds.has(row.orderId)))
          .map((row) => ({
          id: row.id,
          kind: row.reasonCode === 'pool_sale' ? ('bought' as const) : ('added' as const),
          at: row.at,
          ...wineLine(row.productName, row.lwin18),
          bottles: bottlesOf(row),
          where: 'uae' as const,
        })),
        ...ukArrived.map((row, index) => ({
          id: `uk-${index}`,
          kind: 'arrived' as const,
          at: row.receivedAt,
          name: row.name,
          detail: row.vintage ? String(row.vintage) : '',
          bottles: row.totalBottles,
          where: 'uk' as const,
        })),
      ].sort((a, b) => (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0)),

      deliveries: [...deliveries.entries()].map(([id, entry]) => ({
        id,
        ...entry,
        bottles: entry.wines.reduce((sum, wine) => sum + wine.bottles, 0),
      })),

      left: leftShown.map((row) => ({
        id: row.id,
        at: row.at,
        ...wineLine(row.productName, row.lwin18),
        bottles: Math.abs(row.quantityBottles ?? row.quantityCases * packOf(row.lwin18)),
        note: leftNote(row),
        ...leftOutcome(row),
        amountUsd: amountOf(row),
      })),

      sold: sold.map((row) => ({
        ...row,
        productName: displayWineName(row.productName),
        amountUsd: round(row.amountUsd),
      })),
      soldUsd: round(sold.reduce((sum, row) => sum + row.amountUsd, 0)),
      // Sales recorded from the warehouse this month, valued at the owner's price
      soldLeftUsd: round(
        leftShown
          .filter((row) => leftOutcome(row).outcome === 'sale')
          .reduce((sum, row) => sum + (amountOf(row) ?? 0), 0),
      ),
      reimbursedUsd: round(
        leftShown
          .filter((row) => leftOutcome(row).outcome === 'reimbursed')
          .reduce((sum, row) => sum + (amountOf(row) ?? 0), 0),
      ),
      // Bottles sold with no price yet: "price being agreed", never $0
      unpricedBottles: leftShown
        .filter((row) => ['sale', 'reimbursed'].includes(leftOutcome(row).outcome) && amountOf(row) == null)
        .reduce((sum, row) => sum + bottlesOfLeft(row), 0),
      // Everything earned to the end of this month, less everything paid
      owedUsd: round(
        leftToDate.reduce((sum, row) => sum + (amountOf(row) ?? 0), 0) +
          (poolToDate?.total ?? 0) -
          (paidToDate?.total ?? 0),
      ),
      paidUsd: round(paid.reduce((sum, row) => sum + row.amountUsd, 0)),

      holdings: holdings.map((row) => {
        const bottles = row.cases * (row.caseConfig ?? 1);
        // The owner's own price where set, otherwise what it cost them
        const ask = askByKey.get(lwinPakKeyOf(row.lwin18));
        const perBottle = ask ?? costs.get(lwinPakKeyOf(row.lwin18))?.importPerBottle ?? null;

        return {
          ...row,
          productName: displayWineName(row.productName),
          bottles,
          valueUsd: perBottle != null ? round(bottles * perBottle) : null,
          valueBasis: ask != null ? ('your price' as const) : perBottle != null ? ('cost' as const) : null,
        };
      }),
      ukHoldings,
      ukReportedAt,
    };
  });

export default memberGetStatement;
