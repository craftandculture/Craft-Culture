import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  or,
  sql,
} from 'drizzle-orm';

import db from '@/database/client';
import {
  logisticsShipmentItems,
  logisticsShipments,
  partners,
  privateClientOrderItems,
  privateClientOrders,
  wmsOwnerPricing,
  wmsOwnerPricingSettings,
  wmsProductPricing,
  wmsStock,
  zohoSalesOrderItems,
  zohoSalesOrders,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { getPricingProductsSchema } from '../schemas/pricingManagerSchema';
import inboundLineKey from '../utils/inboundLineKey';
import inboundPricingInput from '../utils/inboundPricingInput';
import inboundPricingSelect from '../utils/inboundPricingSelect';
import INBOUND_SHIPMENT_STATUSES from '../utils/inboundShipmentStatuses';
import lotShipmentCost from '../utils/lotShipmentCost';
import lwinPakKey from '../utils/lwinPakKey';
import ownerPricingJoin, { ownerPriced } from '../utils/ownerPricingJoin';
import ownerPricingReady from '../utils/ownerPricingReady';
import stockPricingInput from '../utils/stockPricingInput';
import stockPricingSelect from '../utils/stockPricingSelect';
import sumAcrossPricingRows from '../utils/sumAcrossPricingRows';

/**
 * Get products with stock and pricing data for the Pricing Manager page
 *
 * Returns paginated products with import/selling prices, plus summary stats for
 * KPI cards (total products, avg margin, unpriced count, total values). Falls
 * back to shipment landed cost when no explicit import price exists.
 */
const adminGetPricingProducts = adminProcedure
  .input(getPricingProductsSchema)
  .query(async ({ input }) => {
    /* A wine several owners hold may be priced per owner; see ownerPricingJoin */
    const ownerReady = await ownerPricingReady();

    const {
      search,
      category,
      ownerId,
      priceFilter,
      priceFilters,
      includeInbound,
      includeSoldOut,
      sortBy,
      sortOrder,
      limit,
      offset,
    } = input;

    // Default hides sold-out SKUs (0 on hand); the "Sold (0 qty)" toggle relaxes
    // the qty>0 gate to >=0 (always true) so depleted lines show. KPI/summary
    // stay stock-on-hand only.
    const conditions = [
      includeSoldOut
        ? gte(sql`SUM(${wmsStock.quantityCases})`, 0)
        : gt(sql`SUM(${wmsStock.quantityCases})`, 0),
    ];
    const whereConditions = [
      includeSoldOut
        ? gte(wmsStock.quantityCases, 0)
        : gt(wmsStock.quantityCases, 0),
    ];

    /*
      Filters combine, because the useful questions are conjunctions.

      They were mutually exclusive, so "released but not on the price list" —
      the state that matters most, since it is released work a customer still
      cannot see — could not be asked at all. Contradictory pairs simply return
      nothing, which is the honest answer to a contradictory question.
    */
    const active = new Set(priceFilters ?? (priceFilter ? [priceFilter] : []));

    if (active.has('unpriced')) {
      conditions.push(
        sql`MAX(${ownerPriced('importPricePerBottle')}) > 0 AND COALESCE(MAX(${ownerPriced('sellingPricePerBottle')}), 0) = 0`,
      );
    }

    if (active.has('lossMaking')) {
      // Below cost = EFFECTIVE PC (computed when owner has a PC%, else stored)
      // at/below landed cost — matches the Below-Cost KPI and the red rows.
      const landedH = sql`(MAX(${ownerPriced('importPricePerBottle')}) + COALESCE(MAX(${ownerPriced('costOverridePerBottle')}), 0) + COALESCE(MAX(${ownerPriced('transferPricePerBottle')}), 2.5))`;
      const effH = sql`(CASE
        WHEN MAX(${wmsOwnerPricingSettings.pcMarginPct}) IS NOT NULL AND MAX(${wmsOwnerPricingSettings.pcMarginPct}) < 100
        THEN ${landedH} / (1 - COALESCE(MAX(${wmsOwnerPricingSettings.inbondMarginPct}), 0) / 100.0) / (1 - MAX(${wmsOwnerPricingSettings.pcMarginPct}) / 100.0)
        ELSE MAX(${ownerPriced('sellingPricePerBottle')})
      END)`;
      conditions.push(sql`${effH} > 0 AND ${effH} <= ${landedH}`);
    }

    if (active.has('noImport')) {
      conditions.push(
        sql`COALESCE(MAX(${ownerPriced('importPricePerBottle')}), 0) = 0`,
      );
    }

    if (active.has('notReleased')) {
      // Still to do. Releasing is the last step of pricing a line, so its
      // absence is the most useful definition of "not finished".
      conditions.push(sql`MAX(${wmsProductPricing.pricingReleasedAt}) IS NULL`);
    }

    if (active.has('released')) {
      conditions.push(
        sql`MAX(${wmsProductPricing.pricingReleasedAt}) IS NOT NULL`,
      );
    }

    if (active.has('onPriceList') || active.has('notOnPriceList')) {
      /*
        One definition of "listed", used both ways.

        Released is not the same question: a line held for its owner, or with no
        cost to price from, never reaches a customer. And the queue of work —
        everything NOT on the list — has to be the exact inverse of that, not a
        second attempt at the same rules, or the two will disagree and a wine
        will belong to neither.
      */
      const listed = sql`(
        MAX(${wmsProductPricing.pricingReleasedAt}) IS NOT NULL
        AND BOOL_AND(${wmsStock.notForSale} = false)
        AND COALESCE(MAX(${ownerPriced('importPricePerBottle')}), 0) > 0
      )`;

      if (active.has('onPriceList')) conditions.push(listed);
      if (active.has('notOnPriceList')) conditions.push(sql`NOT ${listed}`);
    }

    if (search) {
      whereConditions.push(
        or(
          ilike(wmsStock.productName, `%${search}%`),
          ilike(wmsStock.producer, `%${search}%`),
          ilike(wmsStock.lwin18, `%${search}%`),
        ),
      );
    }

    if (category) {
      if (category === 'Wine') {
        whereConditions.push(
          or(eq(wmsStock.category, 'Wine'), sql`${wmsStock.category} IS NULL`),
        );
      } else {
        whereConditions.push(eq(wmsStock.category, category));
      }
    }

    if (ownerId) {
      whereConditions.push(eq(wmsStock.ownerId, ownerId));
    }

    // Sort expression mapping
    const sortExpressions = {
      productName: sql`MAX(${wmsStock.productName})`,
      vintage: sql`MAX(${wmsStock.vintage})`,
      totalCases: sumAcrossPricingRows(wmsStock.quantityCases),
      importPrice: sql`MAX(${ownerPriced('importPricePerBottle')})`,
      sellingPrice: sql`MAX(${ownerPriced('sellingPricePerBottle')})`,
      margin: sql`CASE WHEN MAX(${ownerPriced('sellingPricePerBottle')}) > 0 AND MAX(${ownerPriced('importPricePerBottle')}) > 0 THEN (1 - MAX(${ownerPriced('importPricePerBottle')}) / MAX(${ownerPriced('sellingPricePerBottle')})) * 100 ELSE -999 END`,
    };

    const sortExpr = sortExpressions[sortBy];
    const orderFn = sortOrder === 'desc' ? desc : asc;

    const products = await db
      .select({
        lwin18: wmsStock.lwin18,
        /*
          One row per wine PER OWNER. The same wine held by two owners has two
          costs — Crurated's Montille and Ihab's arrived on different invoices
          at different prices — and one row could only show one of them.
        */
        ownerId: wmsStock.ownerId,
        /*
          What the row is priced from — the newest lot's cost, the owner's own
          figures and rates. Shared with the price lists, so they are fed
          exactly what this screen is.
        */
        ...stockPricingSelect,
        productName: sql<string>`MAX(${wmsStock.productName})`,
        producer: sql<string | null>`MAX(${wmsStock.producer})`,
        vintage: sql<number | null>`MAX(${wmsStock.vintage})`,
        caseConfig: sql<number | null>`MAX(${wmsStock.caseConfig})`,
        bottleSize: sql<string | null>`MAX(${wmsStock.bottleSize})`,
        totalCases: sql<number>`${sumAcrossPricingRows(wmsStock.quantityCases)}::int`,
        // Owner(s) holding this SKU — drives the per-row owner badge in the
        // Pricing Manager. Usually one; ownerCount > 1 means the same lwin18 is
        // split across consignors (rare, but worth flagging visually).
        ownerNames: sql<string[]>`array_agg(DISTINCT ${wmsStock.ownerName})`,
        ownerCount: sql<number>`COUNT(DISTINCT ${wmsStock.ownerId})::int`,
        /*
          Who else holds this wine. A price set on one row of a wine several
          owners hold is that owner's alone; the screen names the others so
          nobody wonders whether theirs moved too.
        */
        otherHolders: sql<string[] | null>`(
          SELECT ARRAY_AGG(DISTINCT s2.owner_name ORDER BY s2.owner_name)
          FROM wms_stock s2
          WHERE ${lwinPakKey(sql`s2.lwin18`)} = ${lwinPakKey(sql`MAX(${wmsStock.lwin18})`)}
            AND s2.owner_id IS DISTINCT FROM ${wmsStock.ownerId}
            AND s2.quantity_cases > 0
        )`,
        /** Priced on its own row, apart from the other holders */
        ownPricing: sql<boolean>`BOOL_OR(opp.opp_id IS NOT NULL)`,
      })
      .from(wmsStock)
      .leftJoin(
        wmsProductPricing,
        sql`${lwinPakKey(wmsProductPricing.lwin18)} = ${lwinPakKey(wmsStock.lwin18)}`,
      )
      .leftJoin(ownerPricingJoin(ownerReady), sql`true`)
      .leftJoin(
        wmsOwnerPricingSettings,
        eq(wmsOwnerPricingSettings.ownerId, wmsStock.ownerId),
      )
      .leftJoin(lotShipmentCost, sql`true`)
      .where(and(...whereConditions))
      .groupBy(wmsStock.lwin18, wmsStock.ownerId)
      .having(and(...conditions))
      .orderBy(orderFn(sortExpr))
      .limit(limit)
      .offset(offset);

    // Break landed cost into its parts: import (paid goods, ex-freight) + system
    // logistics (live group freight) + transfer + override. A stored manual
    // import price wins over the shipment product cost.
    // Last sold price/btl — the most recent realized sale across Zoho
    // (dispatched/delivered/invoiced) and PCO (delivered/distributor_paid),
    // matched pack-agnostically (LWIN7+vintage+size). Rate/price is per ordered
    // pack → ÷ pack for per-bottle.
    const pak = (l: string) => {
      const s = l.split('-');
      return `${s[0] ?? ''}-${s[1] ?? ''}-${s[3] ?? ''}`;
    };
    const wantedKeys = new Set(products.map((p) => pak(p.lwin18)));
    const lastSoldMap: Record<
      string,
      {
        pricePerBottle: number;
        ref: string;
        soldAt: Date | null;
        tier: 'B2B' | 'PC';
      }
    > = {};
    const isNewer = (a: Date | null, b: { soldAt: Date | null } | undefined) =>
      !b || (a != null && (b.soldAt == null || a > b.soldAt));
    /*
      The same, per owner: a sale whose stock line is known belongs to that
      line's owner. Montille Bourgogne Blanc is held by Crurated and Ihab, and
      both rows showed the one sale (SO-00200) whoever's bottles it was.
    */
    const lastSoldByOwner: typeof lastSoldMap = {};
    const record = (
      key: string,
      ownerOfSale: string | null,
      sale: (typeof lastSoldMap)[string],
    ) => {
      if (isNewer(sale.soldAt, lastSoldMap[key])) lastSoldMap[key] = sale;

      const ownKey = `${key}|${ownerOfSale ?? ''}`;

      if (ownerOfSale && isNewer(sale.soldAt, lastSoldByOwner[ownKey])) {
        lastSoldByOwner[ownKey] = sale;
      }
    };

    const zohoSold = await db
      .select({
        sku: zohoSalesOrderItems.sku,
        rate: zohoSalesOrderItems.rate,
        description: zohoSalesOrderItems.description,
        ref: zohoSalesOrders.salesOrderNumber,
        soldAt: zohoSalesOrders.updatedAt,
        ownerOfSale: sql<string | null>`(
          SELECT st.owner_id FROM wms_stock st WHERE st.id = ${zohoSalesOrderItems.stockId}
        )`,
      })
      .from(zohoSalesOrderItems)
      .innerJoin(
        zohoSalesOrders,
        eq(zohoSalesOrders.id, zohoSalesOrderItems.salesOrderId),
      )
      .where(
        and(
          // Realized sale: shipped, OR billed in Zoho (zoho_status='invoiced')
          or(
            inArray(zohoSalesOrders.status, ['dispatched', 'delivered']),
            eq(zohoSalesOrders.zohoStatus, 'invoiced'),
          ),
          gt(zohoSalesOrderItems.rate, 0),
        ),
      )
      .orderBy(desc(zohoSalesOrders.updatedAt));

    for (const r of zohoSold) {
      if (!r.sku) continue;
      const key = pak(r.sku);
      if (!wantedKeys.has(key)) continue;
      const pack =
        Number(/^(\d+)/.exec(r.description ?? '')?.[1]) ||
        Number(r.sku.split('-')[2]) ||
        1;
      record(key, r.ownerOfSale, {
        pricePerBottle: Math.round((r.rate / pack) * 100) / 100,
        ref: r.ref,
        soldAt: r.soldAt,
        tier: 'B2B',
      });
    }

    const pcoSold = await db
      .select({
        lwin: privateClientOrderItems.lwin,
        priceCase: privateClientOrderItems.pricePerCaseUsd,
        caseConfig: privateClientOrderItems.caseConfig,
        ref: privateClientOrders.orderNumber,
        soldAt: privateClientOrders.updatedAt,
        ownerOfSale: sql<string | null>`(
          SELECT st.owner_id FROM wms_stock st
          WHERE st.id = ${privateClientOrderItems.sourceStockId}
        )`,
      })
      .from(privateClientOrderItems)
      .innerJoin(
        privateClientOrders,
        eq(privateClientOrders.id, privateClientOrderItems.orderId),
      )
      .where(
        and(
          inArray(privateClientOrders.status, [
            'delivered',
            'distributor_paid',
          ]),
          gt(privateClientOrderItems.pricePerCaseUsd, 0),
        ),
      )
      .orderBy(desc(privateClientOrders.updatedAt));

    for (const r of pcoSold) {
      if (!r.lwin) continue;
      const key = pak(r.lwin);
      if (!wantedKeys.has(key)) continue;
      const pack = r.caseConfig && r.caseConfig > 0 ? r.caseConfig : 1;
      record(key, r.ownerOfSale, {
        pricePerBottle: Math.round((r.priceCase / pack) * 100) / 100,
        ref: r.ref,
        soldAt: r.soldAt,
        tier: 'PC',
      });
    }

    const enrichedProducts = products.map((p) => {
      return {
        /*
          importPricePerBottle becomes the PAID goods cost (ex-freight) and
          systemLogistics the newest lot's live freight — the same resolution
          the price lists price from.
        */
        ...stockPricingInput(p),
        // most recent realized sale (Zoho B2B or PCO), null if never sold
        /*
          This owner's own last sale; the wine's only where nobody else holds
          it, since then there is no doubt whose bottles sold.
        */
        lastSold:
          lastSoldByOwner[`${pak(p.lwin18)}|${p.ownerId ?? ''}`] ??
          ((p.otherHolders ?? []).length === 0
            ? (lastSoldMap[pak(p.lwin18)] ?? null)
            : null),
      };
    });

    // Count total for pagination
    const countSubquery = db
      .select({
        lwin18: wmsStock.lwin18,
      })
      .from(wmsStock)
      .leftJoin(
        wmsProductPricing,
        sql`${lwinPakKey(wmsProductPricing.lwin18)} = ${lwinPakKey(wmsStock.lwin18)}`,
      )
      .leftJoin(ownerPricingJoin(ownerReady), sql`true`)
      .leftJoin(
        wmsOwnerPricingSettings,
        eq(wmsOwnerPricingSettings.ownerId, wmsStock.ownerId),
      )
      .where(and(...whereConditions))
      .groupBy(wmsStock.lwin18, wmsStock.ownerId)
      .having(and(...conditions))
      .as('counted');

    const [countResult] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(countSubquery);

    const totalCount = countResult?.count ?? 0;

    // Summary stats — respect owner + category filter
    const summaryConditions = [gt(wmsStock.quantityCases, 0)];
    if (ownerId) {
      summaryConditions.push(eq(wmsStock.ownerId, ownerId));
    }
    if (category === 'Wine') {
      summaryConditions.push(
        or(eq(wmsStock.category, 'Wine'), sql`${wmsStock.category} IS NULL`)!,
      );
    } else if (category) {
      summaryConditions.push(eq(wmsStock.category, category));
    }

    // Per-owner landed cost and EFFECTIVE PC (what the table shows): when the
    // owner has a PC%, PC = landed/(1-inbond%)/(1-pc%) (always > landed, so not
    // "below cost"); otherwise the stored owner/default price. This keeps the
    // gap KPIs in step with the displayed rows instead of stale stored prices.
    // Import falls back to the latest shipment cost when no stored import price
    // (same as the displayed rows), so stock values aren't understated.
    // Landed = import (paid goods, ex-freight) + system logistics (live group
    // freight = shipment landed − product) + FZ→mainland transfer (default
    // $2.50) + manual override. Replaces the old flat owner logistics rate.
    // Same rule as the rows: an own invoice line beats a typed import price
    const importPaidExpr = sql`COALESCE(CASE WHEN ship.own_line THEN NULLIF(ship.product_cost, 0) END, NULLIF(${ownerPriced('importPricePerBottle')}, 0), ship.product_cost, 0)`;
    const freightExpr = sql`GREATEST(COALESCE(ship.landed_cost, 0) - COALESCE(ship.product_cost, 0), 0)`;
    // Logistics = per-line override if set; else live freight; else $22.50
    // fallback for C&C-owned wine with no freight profile (old imports).
    // Non-C&C / non-wine with no freight = 0.
    // Logistics = per-line override; else live group freight; else the $22.50
    // fallback for C&C-owned wine with no freight profile (old imports).
    //
    // ZERO IS CORRECT for partner-owned stock: on those consignments the PARTNER
    // pays the freight, so C&C has no logistics cost to recover and landed is
    // import + transfer. Do not "fix" this by defaulting to the owner's
    // logistics rate — that inflates landed cost, and every price built on it,
    // on exactly the stock C&C ships for free.
    const logisticsExpr = sql`COALESCE(${ownerPriced('logisticsPerBottle')}, (CASE WHEN ${freightExpr} > 0 THEN ${freightExpr} WHEN ${wmsStock.ownerName} ILIKE '%craft%culture%' AND (${wmsStock.category} = 'Wine' OR ${wmsStock.category} IS NULL) THEN 22.5 ELSE 0 END))`;
    const transferExpr = sql`COALESCE(${ownerPriced('transferPricePerBottle')}, CASE WHEN ${wmsStock.ownerName} ILIKE '%cru wine%' OR ${wmsStock.ownerName} ILIKE '%crurated%' THEN 0 ELSE 2.5 END)`;
    const overrideExpr = sql`COALESCE(${ownerPriced('costOverridePerBottle')}, 0)`;
    const landedExpr = sql`(CASE WHEN (${importPaidExpr} > 0 OR ${overrideExpr} <> 0) THEN ${importPaidExpr} + ${logisticsExpr} + ${transferExpr} + ${overrideExpr} ELSE 0 END)`;
    // The margin for each book, most specific source first: a per-line override,
    // then the band matching this wine's landed cost (the owner's own band
    // before the house one, and a narrower band before a wider one), then the
    // owner's flat rate, then 10%. Mirrors resolvePricingMargins, which holds
    // the same precedence in testable form.
    const bandPick = (column: 'b2b_margin_pct' | 'pc_margin_pct') => sql`(
      SELECT b.${sql.raw(column)} FROM wms_pricing_bands b
       WHERE (b.owner_id = ${wmsStock.ownerId} OR b.owner_id IS NULL)
         AND ${landedExpr} >= b.min_landed_per_bottle
         AND (b.max_landed_per_bottle IS NULL OR ${landedExpr} < b.max_landed_per_bottle)
         AND b.${sql.raw(column)} < 100
       ORDER BY (b.owner_id IS NULL),
                COALESCE(b.max_landed_per_bottle - b.min_landed_per_bottle, 1e9)
       LIMIT 1
    )`;

    const b2bMarginExpr = sql`COALESCE(
      NULLIF(${ownerPriced('b2bMarginPct')}, 100),
      ${bandPick('b2b_margin_pct')},
      ${wmsOwnerPricingSettings.inbondMarginPct},
      10
    )`;
    const pcMarginExpr = sql`COALESCE(
      NULLIF(${ownerPriced('pcMarginPct')}, 100),
      ${bandPick('pc_margin_pct')},
      ${wmsOwnerPricingSettings.pcMarginPct},
      10
    )`;

    // In-bond (B2B) price = landed / (1 - b2b%). C&C's profit = in-bond - landed.
    const inBondExpr = sql`(${landedExpr} / (1 - ${b2bMarginExpr} / 100.0))`;
    // PC = landed / (1 - pc%). A margin over LANDED in its own right: it no
    // longer compounds on top of the B2B price, so moving one book cannot
    // silently move the other. A hand-typed PC price still wins.
    const pcExpr = sql`(CASE
      WHEN COALESCE(${wmsOwnerPricing.pcSellingPricePerBottle}, 0) > 0
      THEN ${wmsOwnerPricing.pcSellingPricePerBottle}
      WHEN ${landedExpr} > 0 THEN ${landedExpr} / (1 - ${pcMarginExpr} / 100.0)
      ELSE COALESCE(${ownerPriced('sellingPricePerBottle')}, 0)
    END)`;
    const bottlesExpr = sql`${wmsStock.quantityCases} * ${wmsStock.caseConfig}`;

    const [summaryResult] = await db
      .select({
        totalProducts: sql<number>`COUNT(DISTINCT ${wmsStock.lwin18})::int`,
        totalImportValue: sql<number>`COALESCE(SUM(${wmsStock.quantityCases} * ${wmsStock.caseConfig} * ${ownerPriced('importPricePerBottle')}), 0)::float`,
        pricedImportCount: sql<number>`COUNT(DISTINCT CASE WHEN ${ownerPriced('importPricePerBottle')} IS NOT NULL AND ${ownerPriced('importPricePerBottle')} > 0 THEN ${wmsStock.lwin18} END)::int`,
        pricedSellingCount: sql<number>`COUNT(DISTINCT CASE WHEN ${ownerPriced('sellingPricePerBottle')} IS NOT NULL AND ${ownerPriced('sellingPricePerBottle')} > 0 THEN ${wmsStock.lwin18} END)::int`,
        // Landed cost value of stock on hand (import/shipment + override + logistics)
        stockAtCost: sql<number>`COALESCE(SUM(${bottlesExpr} * ${landedExpr}), 0)::float`,
        // In-bond (B2B) value of stock
        inBondValue: sql<number>`COALESCE(SUM(CASE WHEN ${landedExpr} > 0 THEN ${bottlesExpr} * ${inBondExpr} END), 0)::float`,
        // Private-client value of stock (effective PC)
        pcValue: sql<number>`COALESCE(SUM(CASE WHEN ${pcExpr} > 0 THEN ${bottlesExpr} * ${pcExpr} END), 0)::float`,
        // C&C profit on stock = in-bond (B2B) price − landed cost
        potentialGrossProfit: sql<number>`COALESCE(SUM(CASE WHEN ${landedExpr} > 0 THEN ${bottlesExpr} * (${inBondExpr} - ${landedExpr}) END), 0)::float`,
        // SKUs priced at/below their landed cost
        belowCostCount: sql<number>`COUNT(DISTINCT CASE WHEN ${pcExpr} > 0 AND ${pcExpr} <= ${landedExpr} THEN ${wmsStock.lwin18} END)::int`,
      })
      .from(wmsStock)
      .leftJoin(
        wmsProductPricing,
        sql`${lwinPakKey(wmsProductPricing.lwin18)} = ${lwinPakKey(wmsStock.lwin18)}`,
      )
      .leftJoin(ownerPricingJoin(ownerReady), sql`true`)
      .leftJoin(
        wmsOwnerPricingSettings,
        eq(wmsOwnerPricingSettings.ownerId, wmsStock.ownerId),
      )
      .leftJoin(
        wmsOwnerPricing,
        and(
          eq(wmsOwnerPricing.lwin18, wmsStock.lwin18),
          eq(wmsOwnerPricing.ownerId, wmsStock.ownerId),
        ),
      )
      .leftJoin(lotShipmentCost, sql`true`)
      .where(and(...summaryConditions));

    // Blended margin = C&C's portfolio margin between in-bond and landed:
    // (in-bond value − landed value) / in-bond value. Value-weighted.
    const inBondValue = summaryResult?.inBondValue ?? 0;
    const stockAtCostVal = summaryResult?.stockAtCost ?? 0;
    const blendedMargin =
      inBondValue > 0
        ? Math.round(((inBondValue - stockAtCostVal) / inBondValue) * 1000) / 10
        : null;

    const unpricedCount =
      (summaryResult?.pricedImportCount ?? 0) -
      (summaryResult?.pricedSellingCount ?? 0);

    // In-transit (inbound shipment) products — returned separately so the
    // on-hand pagination is untouched. Cost comes from the shipment.

    type InboundRow = {
      lwin18: string;
      productName: string;
      producer: string | null;
      vintage: number | null;
      caseConfig: number | null;
      bottleSize: string | null;
      totalCases: number;
      category: string | null;
      ownerNames: string[];
      ownerCount: number;
      /** The shipment's partner — who owns this wine while it is in transit. */
      ownerId: string | null;
      ownerLogistics: number | null;
      ownerInbondPct: number | null;
      ownerPcPct: number | null;
      importPricePerBottle: number | null;
      /** 1 for Cru Wine / Crurated, whose transfer defaults to $0 */
      isZeroTransferOwner: number;
      sellingPricePerBottle: number | null;
      costOverridePerBottle: number | null;
      lineLogistics: number | null;
      transferPricePerBottle: number | null;
      sellMarginPct: number | null;
      b2bMarginPct: number | null;
      pcMarginPct: number | null;
      pricingReleasedAt: Date | null;
      /** Held for its owner — never listed, whatever else is true */
      notForSale: boolean;
      /** No HS code means the wine feed never sees it */
      hsCode: string | null;
      shipmentStatus: string;
      /** Per-line override, else allocated freight, else the air estimate. */
      systemLogistics: number;
      /** True while that figure is the estimate rather than a real invoice. */
      logisticsIsEstimate: boolean;
      earliestEta: Date | null;
      /** Which consignment this line arrived on — two can hold the same wine. */
      shipmentNumber: string | null;
      isInbound: true;
    };
    let inbound: InboundRow[] = [];

    if (includeInbound) {
      // Grouped by SHIPMENT as well as wine and pack. The same wine arriving on
      // two consignments has two different costs, and merging them showed one
      // line at MAX(cost) — so half the bottles were priced off the wrong cost
      // and the cheaper consignment's margin was invisible.
      const groupKey = sql`${logisticsShipmentItems.shipmentId}::text || '|' || COALESCE(${logisticsShipmentItems.lwin}, ${logisticsShipmentItems.productName}) || '-' || COALESCE(${logisticsShipmentItems.bottlesPerCase}::text, '12') || 'x' || COALESCE(${logisticsShipmentItems.bottleSizeMl}::text, '750')`;
      const inboundConditions = [
        eq(logisticsShipments.type, 'inbound'),
        // Filtering by owner used to drop in-transit wine entirely, because it
        // had no owner to match on.
        ...(ownerId ? [eq(logisticsShipments.partnerId, ownerId)] : []),
        inArray(logisticsShipments.status, [...INBOUND_SHIPMENT_STATUSES]),
        /*
          In-transit lines are where pricing is actually done, so the
          released filter has to reach them too — filtering the landed list
          alone would leave the toggle looking broken in the one place it
          matters.
        */
        /*
          Matched pack-agnostically, like the badge beside it.

          Written to match the price list's own gate, which asked on the exact
          code — so a wine released under its 2-pack sat in "Not on price list"
          wearing an ON PRICE LIST badge on its 4-pack line. The filter and the
          badge have to answer the same question or the queue lies.
        */
        ...(active.has('notReleased') || active.has('released')
          ? [
              sql`${active.has('notReleased') ? sql`NOT EXISTS` : sql`EXISTS`} (
                SELECT 1 FROM wms_product_pricing rel
                 WHERE ${lwinPakKey(sql`rel.lwin18`)} = ${inboundLineKey()}
                   AND rel.pricing_released_at IS NOT NULL
              )`,
            ]
          : []),
        /*
          The same definition of "listed" as the landed side, used both ways —
          so "on the price list" and "not on the price list" are one rule read
          in two directions rather than two rules that can drift apart.

          Held for its owner, unclassified, or with no cost: any one of those
          keeps a wine off the list however thoroughly it has been released.

          "Has a cost" means what the row means by it — a manually entered
          import price, the shipment's own figure, or an override. Asking only
          for the shipment's figure put a wine priced by hand into the queue of
          unlisted work while its badge read "On price list", which is two
          definitions of one thing disagreeing in the same row.
        */
        ...(active.has('onPriceList') || active.has('notOnPriceList')
          ? [
              (() => {
                const listed = sql`(
                  EXISTS (
                    SELECT 1 FROM wms_product_pricing rel
                     WHERE ${lwinPakKey(sql`rel.lwin18`)} = ${inboundLineKey()}
                       AND rel.pricing_released_at IS NOT NULL
                  )
                  AND COALESCE(${logisticsShipmentItems.notForSale}, ${logisticsShipments.notForSale}) = false
                  AND ${logisticsShipmentItems.hsCode} IS NOT NULL
                  AND (
                    COALESCE(
                      ${wmsProductPricing.importPricePerBottle},
                      ${logisticsShipmentItems.productCostPerBottle},
                      0
                    ) > 0
                    OR ${wmsProductPricing.costOverridePerBottle} IS NOT NULL
                  )
                )`;

                return active.has('onPriceList') ? listed : sql`NOT ${listed}`;
              })(),
            ]
          : []),
      ];
      if (active.has('noImport')) {
        inboundConditions.push(
          sql`COALESCE(${logisticsShipmentItems.productCostPerBottle}, 0) = 0`,
        );
      }

      if (search) {
        inboundConditions.push(
          or(
            ilike(logisticsShipmentItems.productName, `%${search}%`),
            ilike(logisticsShipmentItems.producer, `%${search}%`),
            ilike(logisticsShipmentItems.lwin, `%${search}%`),
          )!,
        );
      }
      if (category) {
        const hsCodes =
          category === 'Wine'
            ? ['22042100', '22041000']
            : category === 'Spirits'
              ? [
                  '22084000',
                  '22083000',
                  '22082000',
                  '22089090',
                  '22085000',
                  '22087000',
                  '22086000',
                ]
              : ['22030000', '22060000'];
        inboundConditions.push(inArray(logisticsShipmentItems.hsCode, hsCodes));
      }

      const inboundRows = await db
        .select({
          lwin18: sql<string>`COALESCE(MAX(${logisticsShipmentItems.lwin}), MAX(${logisticsShipmentItems.productName}))`,
          productName: sql<string>`MAX(${logisticsShipmentItems.productName})`,
          producer: sql<string | null>`MAX(${logisticsShipmentItems.producer})`,
          caseConfig: sql<
            number | null
          >`MAX(${logisticsShipmentItems.bottlesPerCase})::int`,
          bottleSizeMl: sql<
            number | null
          >`MAX(${logisticsShipmentItems.bottleSizeMl})::int`,
          totalCases: sql<number>`${sumAcrossPricingRows(logisticsShipmentItems.cases)}::int`,
          /*
            What the line is priced from, shared with the in-transit price
            list so the two are fed the same figures.
          */
          ...inboundPricingSelect,
          /*
            Released for THIS owner, not for anyone who happens to hold the
            wine. The flag used to live on the pricing row, which is keyed on
            the wine alone, so a client's consignment read as published because
            C&C had released its own stock of the same wine.
          */
          /*
            Everything the price list also insists on.

            "On price list" only ever meant "released", while the catalogue
            applies several more gates — held for its owner, no HS code so it
            falls outside the Wine feed, a shipment whose status has moved past
            in-transit. A wine could carry the badge and be absent from the
            list with nothing to explain the gap.
          */
          pricingReleasedAt: sql<Date | null>`MAX(${wmsProductPricing.pricingReleasedAt})`,
          notForSale: sql<boolean>`BOOL_OR(COALESCE(${logisticsShipmentItems.notForSale}, ${logisticsShipments.notForSale}))`,
          hsCode: sql<string | null>`MAX(${logisticsShipmentItems.hsCode})`,
          shipmentStatus: sql<string>`MAX(${logisticsShipments.status}::text)`,

          earliestEta: sql<Date | null>`MIN(${logisticsShipments.eta})`,
          shipmentNumber: sql<
            string | null
          >`MAX(${logisticsShipments.shipmentNumber})`,
          // In-transit wine has an owner — the shipment's partner — it was just
          // never joined, so the row showed no owner and quietly took the house
          // rates instead of that partner's.
          ownerId: sql<
            string | null
          >`MAX(${logisticsShipments.partnerId}::text)`,
          ownerName: sql<string | null>`MAX(${partners.businessName})`,
        })
        .from(logisticsShipmentItems)
        .innerJoin(
          logisticsShipments,
          eq(logisticsShipmentItems.shipmentId, logisticsShipments.id),
        )
        .leftJoin(partners, eq(partners.id, logisticsShipments.partnerId))
        .leftJoin(
          wmsOwnerPricingSettings,
          eq(wmsOwnerPricingSettings.ownerId, logisticsShipments.partnerId),
        )
        .leftJoin(
          wmsProductPricing,
          sql`${lwinPakKey(wmsProductPricing.lwin18)} = ${lwinPakKey(logisticsShipmentItems.lwin)}`,
        )
        .where(and(...inboundConditions))
        .groupBy(groupKey)
        .orderBy(asc(sql`MAX(${logisticsShipmentItems.productName})`))
        .limit(300);

      inbound = inboundRows.map((r) => ({
        lwin18: r.lwin18,
        productName: r.productName,
        producer: r.producer,
        // Derive vintage from a dashed LWIN (positions 8-11); null if the key
        // is a product-name fallback rather than a real LWIN.
        vintage: /^\d{7}-(\d{4})-/.test(r.lwin18)
          ? Number(r.lwin18.slice(8, 12))
          : null,
        caseConfig: r.caseConfig,
        bottleSize: r.bottleSizeMl != null ? `${r.bottleSizeMl / 10}cl` : null,
        totalCases: r.totalCases,
        category: r.category,
        ownerNames: r.ownerName ? [r.ownerName] : [],
        ownerCount: r.ownerName ? 1 : 0,
        ownerId: r.ownerId,
        ownerLogistics: r.ownerLogistics,
        ownerInbondPct: r.ownerInbondPct,
        ownerPcPct: r.ownerPcPct,
        importPricePerBottle: r.importPricePerBottle,
        isZeroTransferOwner: r.isZeroTransferOwner,
        sellingPricePerBottle: r.sellingPricePerBottle,
        costOverridePerBottle: r.costOverridePerBottle,
        lineLogistics: r.lineLogistics,
        transferPricePerBottle: r.transferPricePerBottle,
        sellMarginPct: r.sellMarginPct,
        b2bMarginPct: r.b2bMarginPct,
        pcMarginPct: r.pcMarginPct,
        pricingReleasedAt: r.pricingReleasedAt,
        notForSale: r.notForSale,
        hsCode: r.hsCode,
        shipmentStatus: r.shipmentStatus,
        /*
          Logistics for in-transit wine: a per-line override, else the freight
          actually allocated to the shipment, else the standing air-freight
          estimate. Most stock flies, and until the freight invoice is loaded
          the alternative is showing $0.00 — which understates landed cost and
          is how a price barely above the buy price reached a price list.
          The estimate gives way to the actuals the moment they arrive.
        */
        systemLogistics: inboundPricingInput(r).systemLogistics,
        logisticsIsEstimate:
          r.lineLogistics == null &&
          !(r.allocatedFreight && r.allocatedFreight > 0),
        earliestEta: r.earliestEta,
        shipmentNumber: r.shipmentNumber,
        isInbound: true as const,
      }));
    }

    return {
      inbound,
      products: enrichedProducts,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + enrichedProducts.length < totalCount,
      },
      summary: {
        totalProducts: summaryResult?.totalProducts ?? 0,
        blendedMargin,
        unpricedCount: Math.max(0, unpricedCount),
        totalImportValue:
          Math.round((summaryResult?.totalImportValue ?? 0) * 100) / 100,
        stockAtCost: Math.round((summaryResult?.stockAtCost ?? 0) * 100) / 100,
        inBondValue: Math.round((summaryResult?.inBondValue ?? 0) * 100) / 100,
        pcValue: Math.round((summaryResult?.pcValue ?? 0) * 100) / 100,
        potentialGrossProfit:
          Math.round((summaryResult?.potentialGrossProfit ?? 0) * 100) / 100,
        belowCostCount: summaryResult?.belowCostCount ?? 0,
      },
    };
  });

export default adminGetPricingProducts;
