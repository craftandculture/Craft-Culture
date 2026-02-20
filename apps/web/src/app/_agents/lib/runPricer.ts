import { createAnthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { and, desc, eq, gt, inArray, isNotNull, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  agentOutputs,
  agentRuns,
  competitorWines,
  logisticsShipmentItems,
  privateClientOrderItems,
  privateClientOrders,
  wmsStock,
  wmsStockMovements,
} from '@/database/schema';

const pricerOutputSchema = z.object({
  executiveSummary: z.string(),
  priceAdjustments: z.array(
    z.object({
      lwin18: z.string().optional(),
      productName: z.string(),
      currentPriceUsd: z.number(),
      suggestedPriceUsd: z.number(),
      changePercent: z.number(),
      reason: z.string(),
      competitorContext: z.string(),
      marginImpact: z.string(),
    }),
  ),
  marginAlerts: z.array(
    z.object({
      productName: z.string(),
      currentMarginPercent: z.number(),
      targetMarginPercent: z.number(),
      issue: z.string(),
    }),
  ),
  competitiveGaps: z.array(
    z.object({
      productName: z.string(),
      ourPriceAed: z.number(),
      competitorPriceAed: z.number(),
      competitorName: z.string(),
      gapPercent: z.number(),
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

const buildMarkdown = (data: z.infer<typeof pricerOutputSchema>) => {
  const lines: string[] = [];
  lines.push('## Executive Summary\n');
  lines.push(data.executiveSummary, '');

  if (data.priceAdjustments.length > 0) {
    lines.push('## Price Adjustments\n');
    lines.push(
      '| Product | Current (USD) | Suggested (USD) | Change | Reason |',
    );
    lines.push(
      '|---------|--------------|----------------|--------|--------|',
    );
    for (const adj of data.priceAdjustments) {
      lines.push(
        `| ${adj.productName} | $${adj.currentPriceUsd.toFixed(2)} | $${adj.suggestedPriceUsd.toFixed(2)} | ${adj.changePercent > 0 ? '+' : ''}${adj.changePercent.toFixed(1)}% | ${adj.reason} |`,
      );
    }
    lines.push('');
    for (const adj of data.priceAdjustments) {
      lines.push(`**${adj.productName}**`);
      lines.push(`- Competitor context: ${adj.competitorContext}`);
      lines.push(`- Margin impact: ${adj.marginImpact}`);
      lines.push('');
    }
  }

  if (data.marginAlerts.length > 0) {
    lines.push('## Margin Alerts\n');
    lines.push('| Product | Current Margin | Target Margin | Issue |');
    lines.push('|---------|---------------|--------------|-------|');
    for (const alert of data.marginAlerts) {
      lines.push(
        `| ${alert.productName} | ${alert.currentMarginPercent.toFixed(1)}% | ${alert.targetMarginPercent.toFixed(1)}% | ${alert.issue} |`,
      );
    }
    lines.push('');
  }

  if (data.competitiveGaps.length > 0) {
    lines.push('## Competitive Gaps\n');
    lines.push(
      '| Product | Our Price (AED) | Competitor Price (AED) | Competitor | Gap |',
    );
    lines.push(
      '|---------|----------------|----------------------|------------|-----|',
    );
    for (const gap of data.competitiveGaps) {
      lines.push(
        `| ${gap.productName} | ${gap.ourPriceAed.toFixed(0)} AED | ${gap.competitorPriceAed.toFixed(0)} AED | ${gap.competitorName} | ${gap.gapPercent > 0 ? '+' : ''}${gap.gapPercent.toFixed(1)}% |`,
      );
    }
    lines.push('');
  }

  if (data.actionItems.length > 0) {
    lines.push('## Action Items\n');
    for (const item of data.actionItems) {
      const emoji =
        item.priority === 'high'
          ? '!!!'
          : item.priority === 'medium'
            ? '!!'
            : '!';
      lines.push(`- **[${emoji}]** ${item.action} — _${item.rationale}_`);
    }
  }

  return lines.join('\n');
};

/**
 * Run Pricer pricing optimization directly (no Trigger.dev dependency)
 */
const runPricer = async () => {
  const [run] = await db
    .insert(agentRuns)
    .values({ agentId: 'pricer', status: 'running' })
    .returning({ id: agentRuns.id });

  if (!run) throw new Error('Failed to create agent run');

  try {
    // 1. Competitor retail prices
    const competitors = await db
      .select({
        competitorName: competitorWines.competitorName,
        productName: competitorWines.productName,
        vintage: competitorWines.vintage,
        sellingPriceAed: competitorWines.sellingPriceAed,
        sellingPriceUsd: competitorWines.sellingPriceUsd,
        lwin18Match: competitorWines.lwin18Match,
      })
      .from(competitorWines)
      .where(eq(competitorWines.isActive, true))
      .orderBy(desc(competitorWines.sellingPriceAed))
      .limit(200);

    if (competitors.length === 0) {
      await db
        .update(agentRuns)
        .set({ status: 'completed', completedAt: new Date() })
        .where(eq(agentRuns.id, run.id));
      return { success: true, skipped: true, reason: 'no_competitor_data' };
    }

    // 2. Our recent selling prices (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const recentSales = await db
      .select({
        productName: privateClientOrderItems.productName,
        avgPricePerBottleUsd:
          sql<number>`AVG(${privateClientOrderItems.pricePerCaseUsd} / NULLIF(${privateClientOrderItems.caseConfig}, 0))`,
        totalQuantity: sql<number>`SUM(${privateClientOrderItems.quantity})`,
        orderCount: sql<number>`COUNT(DISTINCT ${privateClientOrderItems.orderId})`,
      })
      .from(privateClientOrderItems)
      .innerJoin(
        privateClientOrders,
        eq(privateClientOrderItems.orderId, privateClientOrders.id),
      )
      .where(gt(privateClientOrders.createdAt, ninetyDaysAgo))
      .groupBy(privateClientOrderItems.productName)
      .limit(200);

    // 3. Stock levels grouped by lwin18
    const stockLevels = await db
      .select({
        lwin18: wmsStock.lwin18,
        productName: wmsStock.productName,
        totalCases: sql<number>`SUM(${wmsStock.availableCases})`,
      })
      .from(wmsStock)
      .where(gt(wmsStock.availableCases, 0))
      .groupBy(wmsStock.lwin18, wmsStock.productName)
      .limit(200);

    // 4. Stock velocity — dispatch/pick movements last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const velocity = await db
      .select({
        lwin18: wmsStockMovements.lwin18,
        productName: wmsStockMovements.productName,
        totalCasesMoved: sql<number>`SUM(${wmsStockMovements.quantityCases})`,
      })
      .from(wmsStockMovements)
      .where(
        and(
          inArray(wmsStockMovements.movementType, ['dispatch', 'pick']),
          gt(wmsStockMovements.performedAt, thirtyDaysAgo),
        ),
      )
      .groupBy(wmsStockMovements.lwin18, wmsStockMovements.productName)
      .limit(200);

    // 5. Landed costs — most recent items with landedCostPerBottle
    const landedCosts = await db
      .select({
        productName: logisticsShipmentItems.productName,
        lwin: logisticsShipmentItems.lwin,
        landedCostPerBottle: logisticsShipmentItems.landedCostPerBottle,
        productCostPerBottle: logisticsShipmentItems.productCostPerBottle,
        vintage: logisticsShipmentItems.vintage,
      })
      .from(logisticsShipmentItems)
      .where(isNotNull(logisticsShipmentItems.landedCostPerBottle))
      .orderBy(desc(logisticsShipmentItems.createdAt))
      .limit(100);

    // Build context strings
    const competitorCtx = competitors
      .map(
        (c) =>
          `${c.competitorName}: ${c.productName} (${c.vintage ?? 'NV'}) — ${c.sellingPriceAed ? `${c.sellingPriceAed} AED` : `${c.sellingPriceUsd} USD`}${c.lwin18Match ? ` [LWIN: ${c.lwin18Match}]` : ''}`,
      )
      .join('\n');

    const salesCtx = recentSales
      .map(
        (s) =>
          `${s.productName}: avg ${s.avgPricePerBottleUsd?.toFixed(2) ?? '?'} USD/bottle, ${s.totalQuantity ?? 0} cases sold across ${s.orderCount ?? 0} orders (90 days)`,
      )
      .join('\n');

    const stockCtx = stockLevels
      .map(
        (s) => `${s.productName} [${s.lwin18}]: ${s.totalCases} cases in stock`,
      )
      .join('\n');

    const velocityCtx = velocity
      .map(
        (v) =>
          `${v.productName} [${v.lwin18}]: ${v.totalCasesMoved} cases moved (30 days)`,
      )
      .join('\n');

    const landedCostCtx = landedCosts
      .map(
        (l) =>
          `${l.productName} (${l.vintage ?? 'NV'})${l.lwin ? ` [LWIN: ${l.lwin}]` : ''}: landed $${l.landedCostPerBottle?.toFixed(2)}/bottle, product cost $${l.productCostPerBottle?.toFixed(2) ?? '?'}/bottle`,
      )
      .join('\n');

    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const result = await generateObject({
      model: anthropic('claude-sonnet-4-5-20250929'),
      schema: pricerOutputSchema,
      system: `You are The Pricer, a dynamic pricing optimization agent for Craft & Culture (C&C), a wine distributor in the UAE/GCC market.

CRITICAL CONTEXT: C&C wins on PRICE — that's the competitive edge. Every pricing decision should maximize competitiveness while protecting margins. You analyze landed costs, competitor retail prices, stock levels, and sales velocity to recommend optimal pricing.

Target margins:
- Standard wines: 25-45%
- Premium/allocated wines: 15-25%

Key pricing factors:
- LANDED COST: The true cost per bottle after freight, duty, handling. This is the floor — never price below landed cost
- COMPETITOR RETAIL: What MMI, JY Wine, and others charge. C&C should undercut where possible
- STOCK LEVELS: Overstock (>20 cases of a single SKU) = consider discount incentives. Low stock (<5 cases) = premium pricing acceptable
- VELOCITY: High velocity (>10 cases/month) = price is working, be careful with changes. Low velocity = consider price reduction to move stock
- SELLING HISTORY: What we've actually charged customers — compare to landed cost for real margin analysis

Currency conversions:
- 1 USD ≈ 3.67 AED
- 1 GBP ≈ 4.67 AED

Guidelines:
- Be data-driven: every recommendation must reference specific numbers
- Flag underpriced products (leaving money on the table) — where our margin is below target and competitors charge more
- Flag overpriced products (losing sales) — where we're priced above competitors or velocity has dropped
- Consider stock position: don't raise prices on overstock, don't discount low-stock items
- Action items should be specific: exact products, exact price changes, exact rationale
- Be honest — if data is insufficient for a recommendation, say so
- Today's date: ${new Date().toISOString().slice(0, 10)}`,
      messages: [
        {
          role: 'user',
          content: `Analyze our pricing and generate optimization recommendations.

COMPETITOR RETAIL PRICES (${competitors.length} wines — per bottle in AED/USD):
${competitorCtx}

OUR RECENT SELLING PRICES (${recentSales.length} products — last 90 days):
${salesCtx || 'No recent sales data available.'}

CURRENT STOCK LEVELS (${stockLevels.length} SKUs):
${stockCtx || 'No stock data available.'}

STOCK VELOCITY — dispatch/pick last 30 days (${velocity.length} SKUs):
${velocityCtx || 'No movement data available.'}

LANDED COSTS (${landedCosts.length} items — most recent shipments):
${landedCostCtx || 'No landed cost data available.'}

Generate a daily Pricer brief with:
1. Executive summary (2-3 sentences on pricing health and key opportunities)
2. Price adjustments — specific products that need repricing, with current vs suggested price, change %, and reasoning
3. Margin alerts — products where current margin is outside target range
4. Competitive gaps — where our price vs competitor price has a significant gap (>10%)
5. Prioritized action items — specific pricing actions to take today`,
        },
      ],
    });

    const data = result.object;
    const markdown = buildMarkdown(data);

    await db.insert(agentOutputs).values({
      agentId: 'pricer',
      runId: run.id,
      type: 'daily-brief',
      title: `Pricer Brief — ${new Date().toISOString().slice(0, 10)}`,
      content: markdown,
      data: data as Record<string, unknown>,
    });

    await db
      .update(agentRuns)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(agentRuns.id, run.id));

    return {
      success: true,
      priceAdjustments: data.priceAdjustments.length,
      marginAlerts: data.marginAlerts.length,
      competitiveGaps: data.competitiveGaps.length,
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

export default runPricer;
