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
  wmsOwnerPricingSettings,
  wmsProductPricing,
  wmsStock,
  zohoSalesOrderItems,
  zohoSalesOrders,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { getPricingProductsSchema } from '../schemas/pricingManagerSchema';
import inboundLineKey from '../utils/inboundLineKey';
import inboundLogisticsPerBottle from '../utils/inboundLogisticsPerBottle';
import INBOUND_SHIPMENT_STATUSES from '../utils/inboundShipmentStatuses';
import invoicedImportMessage from '../utils/invoicedImportMessage';
import lotShipmentCost from '../utils/lotShipmentCost';
import lwinPakKey from '../utils/lwinPakKey';
import ownerPricingJoin, { ownerPriced } from '../utils/ownerPricingJoin';
import ownerPricingReady from '../utils/ownerPricingReady';
import pricingManagerCostParts from '../utils/pricingManagerCostParts';
import sumAcrossPricingRows from '../utils/sumAcrossPricingRows';

/**
 * Get products with stock and pricing data for the Pricing Manager page
 *
 * Returns paginated products with import/selling prices, plus the on-hand rows
 * the KPI tiles are summed from (priced on the page by pricePricingManagerRow,
 * like the table). Falls back to shipment landed cost when no explicit import
 * price exists.
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
      // at/below landed cost. An SQL approximation of the row model: the
      // Below Cost tile itself is counted from the priced rows.
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

    /*
      Everything a row is priced from, selected once and used twice: by the
      table rows and by the rows the KPI tiles are summed from. Two selects
      would drift, and the tiles would disagree with the table again.
    */
    const pricingInputColumns = {
      // The newest lot's paid and landed cost — see lotShipmentCost
      lotProductCost: sql<number | null>`(array_agg(ship.product_cost ORDER BY ${wmsStock.receivedAt} DESC NULLS LAST))[1]`,
      lotLandedCost: sql<number | null>`(array_agg(ship.landed_cost ORDER BY ${wmsStock.receivedAt} DESC NULLS LAST))[1]`,
      lotOwnLine: sql<boolean | null>`(array_agg(ship.own_line ORDER BY ${wmsStock.receivedAt} DESC NULLS LAST))[1]`,
      category: sql<string | null>`MAX(${wmsStock.category})`,
      // 1 when Craft & Culture owns this stock — drives the $22.50 wine
      // logistics fallback for old C&C imports with no freight profile.
      isCraftCulture: sql<number>`MAX(CASE WHEN ${wmsStock.ownerName} ILIKE '%craft%culture%' THEN 1 ELSE 0 END)::int`,
      // 1 for consignment owners (Cru Wine / Crurated) — their transfer fee
      // default is $0 rather than the $2.50 FZ→mainland default.
      isZeroTransferOwner: sql<number>`MAX(CASE WHEN ${wmsStock.ownerName} ILIKE '%cru wine%' OR ${wmsStock.ownerName} ILIKE '%crurated%' THEN 1 ELSE 0 END)::int`,
      importPricePerBottle: sql<
        number | null
      >`MAX(${ownerPriced('importPricePerBottle')})`,
      costOverridePerBottle: sql<
        number | null
      >`MAX(${ownerPriced('costOverridePerBottle')})`,
      // Per-line logistics override ($/btl); null = fall back to owner/global
      lineLogistics: sql<
        number | null
      >`MAX(${ownerPriced('logisticsPerBottle')})`,
      // Per-SKU FZ→mainland transfer fee ($/btl); null = the $2.50 default
      transferPricePerBottle: sql<
        number | null
      >`MAX(${ownerPriced('transferPricePerBottle')})`,
      sellingPricePerBottle: sql<
        number | null
      >`MAX(${ownerPriced('sellingPricePerBottle')})`,
      // Bespoke per-line margin % over landed (Spirits/RTD only)
      sellMarginPct: sql<
        number | null
      >`MAX(${ownerPriced('sellMarginPct')})`,
      /*
        A margin typed on THIS line, which beats the owner's rate.

        The row already prefers a per-line margin over the owner's — but the
        landed select never returned one, so typing a margin on a wine wrote
        it, the row refetched, found nothing, fell back to the owner's rate
        and snapped straight back to 10%. It read as a cell that could not be
        edited; it was a cell whose answer was being fetched from somewhere
        the answer had not been written.

        The in-transit select has always returned these, which is why it
        worked there and not here.
      */
      b2bMarginPct: sql<
        number | null
      >`MAX(${ownerPriced('b2bMarginPct')})`,
      pcMarginPct: sql<number | null>`MAX(${ownerPriced('pcMarginPct')})`,
      // Owner's own rates (explicit settings; null if the owner hasn't set them)
      ownerLogistics: sql<
        number | null
      >`MAX(${wmsOwnerPricingSettings.logisticsPerBottle})`,
      ownerInbondPct: sql<
        number | null
      >`MAX(${wmsOwnerPricingSettings.inbondMarginPct})`,
      ownerPcPct: sql<
        number | null
      >`MAX(${wmsOwnerPricingSettings.pcMarginPct})`,
    };

    const products = await db
      .select({
        lwin18: wmsStock.lwin18,
        /*
          One row per wine PER OWNER. The same wine held by two owners has two
          costs — Crurated's Montille and Ihab's arrived on different invoices
          at different prices — and one row could only show one of them.
        */
        ownerId: wmsStock.ownerId,
        ...pricingInputColumns,
        /** The shipment the newest lot's invoice line is on, for the locked Import cell */
        lotShipmentNumber: sql<string | null>`(
          SELECT ls.shipment_number FROM logistics_shipments ls
          WHERE ls.id = (array_agg(ship.shipment_id ORDER BY ${wmsStock.receivedAt} DESC NULLS LAST))[1]
        )`,
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
      const cost = pricingManagerCostParts(p);

      return {
        ...p,
        // importPricePerBottle now carries the PAID goods cost (ex-freight)
        importPricePerBottle: cost.importPricePerBottle,
        /*
          Set from the stock's own supplier invoice, so a typed import price
          would be ignored: the cell is shown read-only, with this reason.
        */
        importLockedReason: cost.importFromInvoice
          ? invoicedImportMessage(p.lotShipmentNumber)
          : null,
        // live group/shipment freight per bottle (read-only; auto-updates)
        systemLogistics: cost.systemLogistics,
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

    /*
      The rows the KPI tiles are summed from: every wine on hand for the
      selected owner and category, with the same pricing inputs and the same
      cost parts as the table rows. The tiles are priced on the page with
      pricePricingManagerRow and the toolbar rates the table uses, so a tile
      is the sum of what the rows show. They used to be priced here in SQL
      with margin tiers and PC on landed cost, a model the rows never used.
    */
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

    const summaryRows = input.includeSummary
      ? (
          await db
            .select({
              lwin18: wmsStock.lwin18,
              ownerId: wmsStock.ownerId,
              ...pricingInputColumns,
              bottles: sql<number>`${sumAcrossPricingRows(sql`${wmsStock.quantityCases} * ${wmsStock.caseConfig}`)}::float`,
              // The owner's stored PC price, as getOwnerPricing returns it to the table
              ownerPcPrice: sql<number | null>`(
                SELECT MAX(op.pc_selling_price_per_bottle) FROM wms_owner_pricing op
                WHERE op.lwin18 = ${wmsStock.lwin18} AND op.owner_id = ${wmsStock.ownerId}
              )`,
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
            .where(and(...summaryConditions))
            .groupBy(wmsStock.lwin18, wmsStock.ownerId)
        ).map((r) => {
          const cost = pricingManagerCostParts(r);

          return {
            lwin18: r.lwin18,
            category: r.category,
            importPricePerBottle: cost.importPricePerBottle,
            costOverridePerBottle: r.costOverridePerBottle,
            systemLogistics: cost.systemLogistics,
            lineLogistics: r.lineLogistics,
            isCraftCulture: r.isCraftCulture,
            transferPricePerBottle: r.transferPricePerBottle,
            isZeroTransferOwner: r.isZeroTransferOwner,
            ownerInbondPct: r.ownerInbondPct,
            ownerPcPct: r.ownerPcPct,
            b2bMarginPct: r.b2bMarginPct,
            pcMarginPct: r.pcMarginPct,
            sellMarginPct: r.sellMarginPct,
            sellingPricePerBottle: r.sellingPricePerBottle,
            ownerPcPrice: r.ownerPcPrice,
            bottles: Number(r.bottles) || 0,
          };
        })
      : [];

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
          // A manually corrected import price wins over the shipment's own
          // figure — it was being ignored, so an edit saved and the row went on
          // showing the old cost.
          costPerBottle: sql<
            number | null
          >`COALESCE(NULLIF(MAX(${wmsProductPricing.importPricePerBottle}), 0), MAX(${logisticsShipmentItems.productCostPerBottle}))`,
          sellingPricePerBottle: sql<
            number | null
          >`MAX(${wmsProductPricing.sellingPricePerBottle})`,
          // Overrides ARE saved against in-transit wine — keyed by LWIN like any
          // other — but none of them were selected here, so the cell a user had
          // just edited came back empty and the edit looked lost.
          costOverridePerBottle: sql<
            number | null
          >`MAX(${wmsProductPricing.costOverridePerBottle})`,
          lineLogistics: sql<
            number | null
          >`MAX(${wmsProductPricing.logisticsPerBottle})`,
          transferPricePerBottle: sql<
            number | null
          >`MAX(${wmsProductPricing.transferPricePerBottle})`,
          sellMarginPct: sql<
            number | null
          >`MAX(${wmsProductPricing.sellMarginPct})`,
          b2bMarginPct: sql<
            number | null
          >`MAX(${wmsProductPricing.b2bMarginPct})`,
          pcMarginPct: sql<
            number | null
          >`MAX(${wmsProductPricing.pcMarginPct})`,
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

          // Freight actually allocated to the shipment line, per bottle. Zero
          // until the freight invoice is loaded against the consolidation group.
          allocatedFreight: sql<
            number | null
          >`MAX(GREATEST(COALESCE(${logisticsShipmentItems.landedCostPerBottle}, 0) - COALESCE(${logisticsShipmentItems.productCostPerBottle}, 0), 0))`,
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
          ownerLogistics: sql<
            number | null
          >`MAX(${wmsOwnerPricingSettings.logisticsPerBottle})`,
          ownerInbondPct: sql<
            number | null
          >`MAX(${wmsOwnerPricingSettings.inbondMarginPct})`,
          ownerPcPct: sql<
            number | null
          >`MAX(${wmsOwnerPricingSettings.pcMarginPct})`,
          category: sql<
            string | null
          >`MAX(CASE WHEN ${logisticsShipmentItems.hsCode} IN ('22042100','22041000') THEN 'Wine' WHEN ${logisticsShipmentItems.hsCode} IN ('22084000','22083000','22082000','22089090','22085000','22087000','22086000') THEN 'Spirits' WHEN ${logisticsShipmentItems.hsCode} IN ('22030000','22060000') THEN 'RTD' ELSE NULL END)`,
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
        importPricePerBottle: r.costPerBottle,
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
        systemLogistics: inboundLogisticsPerBottle(
          r.lineLogistics,
          r.allocatedFreight,
        ),
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
      /** Priced into the KPI tiles on the page; see summarisePricingManagerRows */
      summaryRows,
    };
  });

export default adminGetPricingProducts;
