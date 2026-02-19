import { createAnthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { eq, gt, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  agentOutputs,
  agentRuns,
  competitorWines,
  productOffers,
  products,
  wmsStock,
} from '@/database/schema';

const scoutOutputSchema = z.object({
  executiveSummary: z.string(),
  priceGaps: z.array(
    z.object({
      productName: z.string(),
      ourPriceAed: z.number(),
      competitorPriceAed: z.number(),
      competitorName: z.string(),
      gapPercent: z.number(),
      recommendation: z.string(),
    }),
  ),
  pricingOpportunities: z.array(
    z.object({
      productName: z.string(),
      competitorName: z.string(),
      competitorPriceAed: z.number(),
      estimatedCostAed: z.number(),
      potentialMarginPercent: z.number(),
      region: z.string().optional(),
      vintage: z.string().optional(),
      rationale: z.string(),
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

const buildMarkdown = (data: z.infer<typeof scoutOutputSchema>) => {
  const lines: string[] = [];
  lines.push('## Executive Summary\n');
  lines.push(data.executiveSummary, '');

  if (data.priceGaps.length > 0) {
    lines.push('## Price Gaps\n');
    lines.push('| Product | Our Price | Competitor | Their Price | Gap |');
    lines.push('|---------|----------|------------|------------|-----|');
    for (const gap of data.priceGaps) {
      const sign = gap.gapPercent > 0 ? '+' : '';
      lines.push(
        `| ${gap.productName} | ${gap.ourPriceAed.toFixed(0)} AED | ${gap.competitorName} | ${gap.competitorPriceAed.toFixed(0)} AED | ${sign}${gap.gapPercent.toFixed(1)}% |`,
      );
    }
    lines.push('');
  }

  if (data.pricingOpportunities.length > 0) {
    lines.push('## Pricing Opportunities\n');
    lines.push('Wines where C&C can source and undercut competitors:\n');
    for (const opp of data.pricingOpportunities) {
      lines.push(
        `- **${opp.productName}** (${opp.vintage ?? 'NV'}) — ${opp.competitorName} sells at ${opp.competitorPriceAed.toFixed(0)} AED, est. cost ${opp.estimatedCostAed.toFixed(0)} AED (~${opp.potentialMarginPercent.toFixed(0)}% margin). _${opp.rationale}_`,
      );
    }
    lines.push('');
  }

  if (data.actionItems.length > 0) {
    lines.push('## Action Items\n');
    for (const item of data.actionItems) {
      const emoji = item.priority === 'high' ? '!!!' : item.priority === 'medium' ? '!!' : '!';
      lines.push(`- **[${emoji}]** ${item.action} — _${item.rationale}_`);
    }
  }

  return lines.join('\n');
};

/**
 * Run Scout competitive analysis directly (no Trigger.dev dependency)
 */
const runScout = async () => {
  const [run] = await db
    .insert(agentRuns)
    .values({ agentId: 'scout', status: 'running' })
    .returning({ id: agentRuns.id });

  if (!run) throw new Error('Failed to create agent run');

  try {
    // Prioritize LWIN-matched wines (direct price comparison) then highest-priced
    const competitors = await db
      .select({
        competitorName: competitorWines.competitorName,
        productName: competitorWines.productName,
        vintage: competitorWines.vintage,
        sellingPriceAed: competitorWines.sellingPriceAed,
        sellingPriceUsd: competitorWines.sellingPriceUsd,
        region: competitorWines.region,
        lwin18Match: competitorWines.lwin18Match,
      })
      .from(competitorWines)
      .where(eq(competitorWines.isActive, true))
      .orderBy(
        sql`CASE WHEN ${competitorWines.lwin18Match} IS NOT NULL THEN 0 ELSE 1 END`,
        sql`COALESCE(${competitorWines.sellingPriceAed}, 0) DESC`,
      )
      .limit(200);

    if (competitors.length === 0) {
      await db
        .update(agentRuns)
        .set({ status: 'completed', completedAt: new Date() })
        .where(eq(agentRuns.id, run.id));
      return { success: true, skipped: true, reason: 'no_competitor_data' };
    }

    const ourProducts = await db
      .select({
        lwin18: products.lwin18,
        name: products.name,
        producer: products.producer,
        country: products.country,
        region: products.region,
        year: products.year,
        offerPrice: productOffers.price,
        offerCurrency: productOffers.currency,
      })
      .from(products)
      .leftJoin(productOffers, eq(productOffers.productId, products.id))
      .limit(200);

    const stockSummary = await db
      .select({
        lwin18: wmsStock.lwin18,
        productName: wmsStock.productName,
        totalCases: sql<number>`SUM(${wmsStock.availableCases})`,
      })
      .from(wmsStock)
      .where(gt(wmsStock.availableCases, 0))
      .groupBy(wmsStock.lwin18, wmsStock.productName)
      .limit(100);

    const competitorCtx = competitors
      .map(
        (c) =>
          `${c.competitorName}: ${c.productName} (${c.vintage ?? 'NV'}) — ${c.sellingPriceAed ? `${c.sellingPriceAed} AED` : `${c.sellingPriceUsd} USD`}${c.lwin18Match ? ` [LWIN: ${c.lwin18Match}]` : ''}`,
      )
      .join('\n');

    const catalogCtx = ourProducts
      .map(
        (p) =>
          `${p.name} (${p.year ?? 'NV'}) by ${p.producer ?? 'Unknown'} — ${p.offerPrice ? `${p.offerPrice} ${p.offerCurrency}` : 'no offer'}${p.lwin18 ? ` [LWIN: ${p.lwin18}]` : ''}`,
      )
      .join('\n');

    const stockCtx = stockSummary
      .map((s) => `${s.productName} [${s.lwin18}]: ${s.totalCases} cases available`)
      .join('\n');

    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const result = await generateObject({
      model: anthropic('claude-sonnet-4-5-20250929'),
      schema: scoutOutputSchema,
      system: `You are The Scout, a competitive pricing analyst for Craft & Culture (C&C), a wine distributor in the UAE/GCC market.

CRITICAL CONTEXT: C&C is a young company competing against established players (MMI, JY Wine, etc.) who have 30+ years and massive scale. C&C CANNOT compete on range — these companies carry thousands of SKUs. But C&C CAN source from anywhere in the world (Bordeaux, Burgundy, Italy, New World, etc.) through its supplier network. The competitive weapon is PRICE. C&C wins business by undercutting on price for wines that matter.

Your job is to analyze competitor pricing and identify where C&C can win on price — either by undercutting competitors on wines we already carry, or by sourcing wines they sell at high margins and offering better prices.

Key context:
- Prices are in AED (UAE Dirham) or USD. 1 USD ≈ 3.67 AED
- Match products using LWIN codes when available, otherwise by name/vintage similarity
- Focus on commercially significant price gaps (>10% difference)
- Prioritize high-value wines and popular regions (Burgundy, Bordeaux, Champagne, Tuscany, Piedmont)
- For "pricing opportunities" — estimate what C&C could source a wine for (use industry standard ~40-50% wholesale margin below competitor retail) and flag wines where the margin opportunity is attractive
- Be honest and realistic. Don't sugarcoat — if competitors have better prices on something, say so
- Action items should be specific and price-focused: which wines to source, what price to target, who to undercut`,
      messages: [
        {
          role: 'user',
          content: `Analyze today's competitive pricing landscape. Focus on where we can WIN on price.

COMPETITOR WINE LISTS (${competitors.length} wines):
${competitorCtx}

OUR CATALOG (${ourProducts.length} products):
${catalogCtx}

OUR CURRENT STOCK (${stockSummary.length} SKUs):
${stockCtx}

Generate a daily Scout brief with:
1. Executive summary (2-3 sentences, focus on price positioning)
2. Top price gaps — where we're cheaper OR more expensive than competitors. Be honest about both directions
3. Pricing opportunities — competitor wines selling at high prices where C&C could source and undercut. Estimate sourcing cost and potential margin
4. Prioritized action items focused on price wins — specific wines to source, prices to target, deals to chase`,
        },
      ],
    });

    const data = result.object;
    const markdown = buildMarkdown(data);

    await db.insert(agentOutputs).values({
      agentId: 'scout',
      runId: run.id,
      type: 'daily-brief',
      title: `Scout Brief — ${new Date().toISOString().slice(0, 10)}`,
      content: markdown,
      data: data as Record<string, unknown>,
    });

    await db
      .update(agentRuns)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(agentRuns.id, run.id));

    return {
      success: true,
      priceGaps: data.priceGaps.length,
      pricingOpportunities: data.pricingOpportunities.length,
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

export default runScout;
