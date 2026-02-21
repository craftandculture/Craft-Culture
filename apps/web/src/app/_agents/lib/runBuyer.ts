import { createAnthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { eq, gt, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  agentOutputs,
  agentRuns,
  supplierWines,
  wmsStock,
} from '@/database/schema';

const buyerOutputSchema = z.object({
  executiveSummary: z.string(),
  reorderAlerts: z.array(
    z.object({
      lwin18: z.string(),
      productName: z.string(),
      currentStock: z.number(),
      weeklyVelocity: z.number(),
      weeksOfStock: z.number(),
      suggestedQuantity: z.number(),
      suggestedSupplier: z.string(),
      estimatedCostUsd: z.number(),
    }),
  ),
  newOpportunities: z.array(
    z.object({
      productName: z.string(),
      supplier: z.string(),
      costPriceUsd: z.number(),
      rationale: z.string(),
    }),
  ),
  overStocked: z.array(
    z.object({
      lwin18: z.string(),
      productName: z.string(),
      currentStock: z.number(),
      weeklyVelocity: z.number(),
      weeksOfStock: z.number(),
      recommendation: z.string(),
    }),
  ),
  actionItems: z.array(
    z.object({
      priority: z.enum(['high', 'medium', 'low']),
      action: z.string(),
      rationale: z.string(),
    }),
  ),
});

const buildMarkdown = (data: z.infer<typeof buyerOutputSchema>) => {
  const lines: string[] = [];
  lines.push('## Executive Summary\n');
  lines.push(data.executiveSummary, '');

  if (data.reorderAlerts.length > 0) {
    lines.push('## Reorder Alerts\n');
    lines.push(
      '| Product | Current Stock | Weekly Velocity | Weeks Left | Suggested Qty | Supplier | Est. Cost (USD) |',
    );
    lines.push(
      '|---------|--------------|----------------|------------|---------------|----------|----------------|',
    );
    for (const alert of data.reorderAlerts) {
      lines.push(
        `| ${alert.productName} | ${alert.currentStock} cases | ${alert.weeklyVelocity.toFixed(1)}/wk | ${alert.weeksOfStock.toFixed(1)} | ${alert.suggestedQuantity} cases | ${alert.suggestedSupplier} | $${alert.estimatedCostUsd.toFixed(0)} |`,
      );
    }
    lines.push('');
  }

  if (data.newOpportunities.length > 0) {
    lines.push('## New Sourcing Opportunities\n');
    for (const opp of data.newOpportunities) {
      lines.push(
        `- **${opp.productName}** from ${opp.supplier} — $${opp.costPriceUsd.toFixed(0)} USD. _${opp.rationale}_`,
      );
    }
    lines.push('');
  }

  if (data.overStocked.length > 0) {
    lines.push('## Overstock Warnings\n');
    lines.push(
      '| Product | Current Stock | Weekly Velocity | Weeks of Stock | Recommendation |',
    );
    lines.push(
      '|---------|--------------|----------------|---------------|----------------|',
    );
    for (const item of data.overStocked) {
      lines.push(
        `| ${item.productName} | ${item.currentStock} cases | ${item.weeklyVelocity.toFixed(1)}/wk | ${item.weeksOfStock.toFixed(1)} | ${item.recommendation} |`,
      );
    }
    lines.push('');
  }

  if (data.actionItems.length > 0) {
    lines.push('## Action Items\n');
    for (const item of data.actionItems) {
      const emoji =
        item.priority === 'high' ? '!!!' : item.priority === 'medium' ? '!!' : '!';
      lines.push(`- **[${emoji}]** ${item.action} — _${item.rationale}_`);
    }
  }

  return lines.join('\n');
};

/**
 * Run Buyer purchasing intelligence directly (no Trigger.dev dependency)
 */
const runBuyer = async () => {
  const [run] = await db
    .insert(agentRuns)
    .values({ agentId: 'buyer', status: 'running' })
    .returning({ id: agentRuns.id });

  if (!run) throw new Error('Failed to create agent run');

  try {
    // 1. Current stock grouped by lwin18
    const stockSummary = await db
      .select({
        lwin18: wmsStock.lwin18,
        productName: wmsStock.productName,
        producer: wmsStock.producer,
        vintage: wmsStock.vintage,
        totalCases: sql<number>`SUM(${wmsStock.availableCases})`,
      })
      .from(wmsStock)
      .where(gt(wmsStock.availableCases, 0))
      .groupBy(
        wmsStock.lwin18,
        wmsStock.productName,
        wmsStock.producer,
        wmsStock.vintage,
      )
      .limit(200);

    if (stockSummary.length === 0) {
      await db
        .update(agentRuns)
        .set({ status: 'completed', completedAt: new Date() })
        .where(eq(agentRuns.id, run.id));
      return { success: true, skipped: true, reason: 'no_stock_data' };
    }

    // 2. Run all independent data queries in parallel
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [
      velocity,
      suppliers,
      demandSignal,
      zohoSalesHistory,
      pcoSalesHistory,
      monthlyRevenue,
    ] = await Promise.all([
      // 2a. Velocity: dispatch + pick movements in last 30 days
      db.execute<{
        lwin18: string;
        totalDispatched: number;
      }>(sql`
        SELECT lwin18,
               SUM(quantity_cases) AS "totalDispatched"
        FROM wms_stock_movements
        WHERE movement_type IN ('dispatch', 'pick')
          AND performed_at > ${thirtyDaysAgo.toISOString()}
        GROUP BY lwin18
      `),

      // 2b. Supplier availability
      db
        .select({
          id: supplierWines.id,
          partnerName: supplierWines.partnerName,
          productName: supplierWines.productName,
          vintage: supplierWines.vintage,
          country: supplierWines.country,
          region: supplierWines.region,
          costPriceUsd: supplierWines.costPriceUsd,
          costPriceGbp: supplierWines.costPriceGbp,
          costPriceEur: supplierWines.costPriceEur,
          moq: supplierWines.moq,
          availableQuantity: supplierWines.availableQuantity,
          lwin18Match: supplierWines.lwin18Match,
        })
        .from(supplierWines)
        .where(eq(supplierWines.isActive, true))
        .limit(200),

      // 2c. PCO demand signal (last 90 days)
      db.execute<{
        productName: string;
        totalQuantity: number;
      }>(sql`
        SELECT oi.product_name AS "productName",
               SUM(oi.quantity) AS "totalQuantity"
        FROM private_client_order_items oi
        JOIN private_client_orders o ON o.id = oi.order_id
        WHERE o.created_at > ${ninetyDaysAgo.toISOString()}
          AND o.status NOT IN ('draft', 'cancelled')
        GROUP BY oi.product_name
        ORDER BY SUM(oi.quantity) DESC
        LIMIT 50
      `),

      // 2d. Zoho sales order history — product-level revenue (all time)
      db.execute<{
        productName: string;
        lwin18: string | null;
        totalQuantity: number;
        totalRevenue: number;
        orderCount: number;
        lastSaleDate: string;
      }>(sql`
        SELECT zoi.name AS "productName",
               zoi.lwin18,
               COALESCE(SUM(zoi.quantity), 0) AS "totalQuantity",
               COALESCE(SUM(zoi.item_total), 0) AS "totalRevenue",
               COUNT(DISTINCT zoi.sales_order_id) AS "orderCount",
               MAX(zo.order_date)::text AS "lastSaleDate"
        FROM zoho_sales_order_items zoi
        JOIN zoho_sales_orders zo ON zo.id = zoi.sales_order_id
        WHERE zo.status NOT IN ('cancelled')
        GROUP BY zoi.name, zoi.lwin18
        ORDER BY SUM(zoi.item_total) DESC NULLS LAST
        LIMIT 100
      `),

      // 2e. PCO sales history with revenue (all time)
      db.execute<{
        productName: string;
        lwin: string | null;
        totalCases: number;
        totalRevenue: number;
        orderCount: number;
        lastSaleDate: string;
      }>(sql`
        SELECT oi.product_name AS "productName",
               oi.lwin,
               COALESCE(SUM(oi.quantity), 0) AS "totalCases",
               COALESCE(SUM(oi.total_usd), 0) AS "totalRevenue",
               COUNT(DISTINCT oi.order_id) AS "orderCount",
               MAX(o.created_at)::text AS "lastSaleDate"
        FROM private_client_order_items oi
        JOIN private_client_orders o ON o.id = oi.order_id
        WHERE o.status NOT IN ('draft', 'cancelled')
        GROUP BY oi.product_name, oi.lwin
        ORDER BY SUM(oi.total_usd) DESC NULLS LAST
        LIMIT 100
      `),

      // 2f. Monthly revenue trend (last 6 months from Zoho invoices)
      db.execute<{
        month: string;
        totalRevenue: number;
        invoiceCount: number;
      }>(sql`
        SELECT TO_CHAR(invoice_date, 'YYYY-MM') AS "month",
               COALESCE(SUM(total), 0) AS "totalRevenue",
               COUNT(*) AS "invoiceCount"
        FROM zoho_invoices
        WHERE status IN ('sent', 'viewed', 'overdue', 'paid', 'partially_paid')
          AND invoice_date >= ${sixMonthsAgo.toISOString().slice(0, 10)}
        GROUP BY TO_CHAR(invoice_date, 'YYYY-MM')
        ORDER BY "month"
      `),
    ]);

    const velocityMap = new Map(
      velocity.map((v) => [v.lwin18, Number(v.totalDispatched)]),
    );

    // 3. Compute weeks of stock for each product
    const stockWithVelocity = stockSummary.map((s) => {
      const dispatched30d = velocityMap.get(s.lwin18) ?? 0;
      const weeklyVelocity = dispatched30d / 4.3;
      const weeksOfStock = weeklyVelocity > 0 ? s.totalCases / weeklyVelocity : 999;
      return {
        ...s,
        dispatched30d,
        weeklyVelocity,
        weeksOfStock,
      };
    });

    // Build context strings
    const stockCtx = stockWithVelocity
      .map(
        (s) =>
          `${s.productName} (${s.vintage ?? 'NV'}) by ${s.producer ?? 'Unknown'} [${s.lwin18}]: ${s.totalCases} cases, velocity ${s.weeklyVelocity.toFixed(1)} cases/wk, ${s.weeksOfStock < 999 ? `${s.weeksOfStock.toFixed(1)} weeks of stock` : 'no recent movement'}`,
      )
      .join('\n');

    const toUsd: Record<string, number> = {
      USD: 1,
      GBP: 1.27,
      EUR: 1.09,
    };

    const supplierCtx = suppliers
      .map((s) => {
        let priceStr = 'price TBD';
        if (s.costPriceUsd) {
          priceStr = `$${s.costPriceUsd.toFixed(0)} USD`;
        } else if (s.costPriceGbp) {
          const usd = s.costPriceGbp * toUsd['GBP']!;
          priceStr = `~$${usd.toFixed(0)} USD (${s.costPriceGbp.toFixed(0)} GBP)`;
        } else if (s.costPriceEur) {
          const usd = s.costPriceEur * toUsd['EUR']!;
          priceStr = `~$${usd.toFixed(0)} USD (${s.costPriceEur.toFixed(0)} EUR)`;
        }
        return `${s.partnerName}: ${s.productName} (${s.vintage ?? 'NV'}) — ${priceStr}${s.moq ? `, MOQ: ${s.moq}` : ''}${s.availableQuantity ? `, avail: ${s.availableQuantity}` : ''}${s.lwin18Match ? ` [LWIN: ${s.lwin18Match}]` : ''}`;
      })
      .join('\n');

    const demandCtx = demandSignal
      .map((d) => `${d.productName}: ${d.totalQuantity} cases ordered (last 90 days)`)
      .join('\n');

    // Build sales history context — Zoho B2B sales (top sellers by revenue)
    const zohoSalesCtx = zohoSalesHistory
      .filter((s) => Number(s.totalRevenue) > 0)
      .map(
        (s) =>
          `${s.productName}${s.lwin18 ? ` [${s.lwin18}]` : ''}: ${Number(s.totalQuantity)} units across ${Number(s.orderCount)} orders, $${Number(s.totalRevenue).toFixed(0)} revenue, last sale ${s.lastSaleDate ?? 'unknown'}`,
      )
      .join('\n');

    // Build PCO sales history context
    const pcoSalesCtx = pcoSalesHistory
      .filter((s) => Number(s.totalRevenue) > 0)
      .map(
        (s) =>
          `${s.productName}${s.lwin ? ` [${s.lwin}]` : ''}: ${Number(s.totalCases)} cases across ${Number(s.orderCount)} orders, $${Number(s.totalRevenue).toFixed(0)} revenue, last sale ${s.lastSaleDate ? s.lastSaleDate.slice(0, 10) : 'unknown'}`,
      )
      .join('\n');

    // Build monthly revenue trend
    const revenueCtx = monthlyRevenue
      .map(
        (m) =>
          `${m.month}: $${Number(m.totalRevenue).toFixed(0)} (${Number(m.invoiceCount)} invoices)`,
      )
      .join('\n');

    const lowStockCount = stockWithVelocity.filter(
      (s) => s.weeksOfStock < 4 && s.weeksOfStock < 999,
    ).length;
    const overStockCount = stockWithVelocity.filter(
      (s) => s.weeksOfStock > 16,
    ).length;

    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const result = await generateObject({
      model: anthropic('claude-sonnet-4-5-20250929'),
      schema: buyerOutputSchema,
      system: `You are Purchasing, a purchasing intelligence agent for Craft & Culture (C&C), a wine distributor in the UAE/GCC market sourcing from UK/EU suppliers.

Your job is to analyze current inventory levels, movement velocity, supplier availability, sales history, and demand signals to generate actionable purchasing recommendations.

Key context:
- C&C sources wine from UK and EU suppliers and distributes in the GCC
- Currency conversions: 1 GBP ~ 4.67 AED, 1 EUR ~ 4.00 AED, 1 USD ~ 3.67 AED
- Reorder threshold: Flag products with LESS THAN 4 weeks of stock as reorder alerts
- Overstock threshold: Flag products with MORE THAN 16 weeks of stock as overstock warnings
- Weekly velocity is calculated from dispatch + pick movements over the last 30 days, divided by 4.3 weeks
- Products with no recent movement (velocity = 0) may be slow movers or new additions — don't flag as overstock unless they have significant quantities
- When suggesting reorder quantities, consider: supplier MOQs, typical order sizes (6-case or 12-case multiples), and lead time (~2-4 weeks from UK/EU)
- When identifying new opportunities, look at supplier wines that match demand patterns but aren't currently in stock
- SALES HISTORY is your memory — use it to identify proven sellers, seasonal patterns, and revenue impact. Prioritize reordering products with strong historical sales.
- Revenue trend shows the business trajectory — factor this into purchasing aggressiveness
- Be practical and specific. Include supplier names, estimated costs, and quantities
- Today's date: ${new Date().toISOString().slice(0, 10)}`,
      messages: [
        {
          role: 'user',
          content: `Generate today's purchasing intelligence brief.

CURRENT STOCK WITH VELOCITY (${stockWithVelocity.length} products):
${stockCtx}

SUPPLIER AVAILABILITY (${suppliers.length} wines):
${supplierCtx || 'No supplier data available.'}

DEMAND SIGNAL — Top products ordered in last 90 days (${demandSignal.length} products):
${demandCtx || 'No recent order data.'}

SALES HISTORY — B2B Sales Orders (top ${zohoSalesHistory.length} products by revenue, all time):
${zohoSalesCtx || 'No Zoho sales order history yet.'}

SALES HISTORY — Private Client Orders (top ${pcoSalesHistory.length} products by revenue, all time):
${pcoSalesCtx || 'No private client order history yet.'}

MONTHLY REVENUE TREND (last 6 months):
${revenueCtx || 'No invoice data available yet.'}

SUMMARY: ${lowStockCount} products below 4-week threshold, ${overStockCount} products above 16-week threshold.

Generate:
1. Executive summary (2-3 sentences on inventory health and purchasing priorities, informed by sales history)
2. Reorder alerts for products below 4 weeks of stock — prioritize proven sellers with strong historical revenue. Include suggested supplier, quantity, and estimated cost
3. New sourcing opportunities — supplier wines that match demand patterns or historical best-sellers but we don't currently stock
4. Overstock warnings for products above 16 weeks of stock — cross-reference with sales history. If a product has strong historical sales, it may be seasonal rather than truly overstocked
5. Prioritized action items — specific purchasing decisions to make today`,
        },
      ],
    });

    const data = result.object;
    const markdown = buildMarkdown(data);

    await db.insert(agentOutputs).values({
      agentId: 'buyer',
      runId: run.id,
      type: 'daily-brief',
      title: `Purchasing Brief — ${new Date().toISOString().slice(0, 10)}`,
      content: markdown,
      data: data as Record<string, unknown>,
    });

    await db
      .update(agentRuns)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(agentRuns.id, run.id));

    return {
      success: true,
      reorderAlerts: data.reorderAlerts.length,
      newOpportunities: data.newOpportunities.length,
      overStocked: data.overStocked.length,
      actionItems: data.actionItems.length,
    };
  } catch (error) {
    await db
      .update(agentRuns)
      .set({
        status: 'failed',
        completedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      .where(eq(agentRuns.id, run.id));

    throw error;
  }
};

export default runBuyer;
