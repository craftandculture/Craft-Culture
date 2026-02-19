import { createAnthropic } from '@ai-sdk/anthropic';
import { logger, schedules } from '@trigger.dev/sdk';
import { generateObject } from 'ai';
import { eq, gt, sql } from 'drizzle-orm';
import { z } from 'zod';

import {
  agentOutputs,
  agentRuns,
  competitorWines,
  productOffers,
  products,
  wmsStock,
} from '@/database/schema';
import triggerDb from '@/trigger/triggerDb';

/**
 * Structured output schema for The Scout's daily brief
 */
const scoutOutputSchema = z.object({
  executiveSummary: z.string().describe('2-3 sentence overview of today\'s competitive landscape'),
  priceGaps: z
    .array(
      z.object({
        productName: z.string(),
        ourPriceAed: z.number(),
        competitorPriceAed: z.number(),
        competitorName: z.string(),
        gapPercent: z.number().describe('Positive = we are more expensive, negative = we are cheaper'),
        recommendation: z.string().describe('Brief pricing action suggestion'),
      }),
    )
    .describe('Top price gaps where competitors are significantly cheaper or more expensive'),
  blindSpots: z
    .array(
      z.object({
        productName: z.string(),
        competitorName: z.string(),
        priceAed: z.number(),
        region: z.string().optional(),
        vintage: z.string().optional(),
      }),
    )
    .describe('Competitor wines we do not carry at all'),
  actionItems: z
    .array(
      z.object({
        priority: z.enum(['high', 'medium', 'low']),
        action: z.string(),
        rationale: z.string(),
      }),
    )
    .describe('Ranked list of recommended actions for the team'),
});

/**
 * Build a readable markdown brief from Scout output data
 */
const buildScoutMarkdown = (data: z.infer<typeof scoutOutputSchema>) => {
  const lines: string[] = [];

  lines.push('## Executive Summary\n');
  lines.push(data.executiveSummary);
  lines.push('');

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

  if (data.blindSpots.length > 0) {
    lines.push('## Blind Spots\n');
    lines.push('Competitor wines we do not carry:\n');
    for (const spot of data.blindSpots) {
      lines.push(
        `- **${spot.productName}** (${spot.vintage ?? 'NV'}) — ${spot.competitorName} at ${spot.priceAed.toFixed(0)} AED`,
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
 * The Scout — Daily competitive intelligence agent
 *
 * Compares C&C product catalog and pricing against uploaded competitor
 * wine lists, identifies price gaps, blind spots, and opportunities.
 *
 * Runs daily at 06:00 GST.
 */
export const scoutDailyJob = schedules.task({
  id: 'scout-daily',
  cron: {
    pattern: '0 6 * * *',
    timezone: 'Asia/Dubai',
  },
  async run() {
    logger.info('Scout agent starting daily analysis');

    // Create run record
    const [run] = await triggerDb
      .insert(agentRuns)
      .values({ agentId: 'scout', status: 'running' })
      .returning({ id: agentRuns.id });

    if (!run) {
      logger.error('Failed to create agent run');
      return { success: false };
    }

    try {
      // 1. Fetch active competitor wines (limit 50)
      const competitors = await triggerDb
        .select({
          id: competitorWines.id,
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
        .limit(50);

      if (competitors.length === 0) {
        logger.warn('No competitor wines found — skipping Scout run');
        await triggerDb
          .update(agentRuns)
          .set({ status: 'completed', completedAt: new Date() })
          .where(eq(agentRuns.id, run.id));
        return { success: true, skipped: true, reason: 'no_competitor_data' };
      }

      // 2. Fetch our products with latest offers
      const ourProducts = await triggerDb
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

      // 3. Fetch current stock summary
      const stockSummary = await triggerDb
        .select({
          lwin18: wmsStock.lwin18,
          productName: wmsStock.productName,
          totalCases: sql<number>`SUM(${wmsStock.availableCases})`,
        })
        .from(wmsStock)
        .where(gt(wmsStock.availableCases, 0))
        .groupBy(wmsStock.lwin18, wmsStock.productName)
        .limit(100);

      // 4. Build context for Claude
      const competitorContext = competitors
        .map(
          (c) =>
            `${c.competitorName}: ${c.productName} (${c.vintage ?? 'NV'}) — ${c.sellingPriceAed ? `${c.sellingPriceAed} AED` : `${c.sellingPriceUsd} USD`}${c.lwin18Match ? ` [LWIN: ${c.lwin18Match}]` : ''}`,
        )
        .join('\n');

      const ourCatalogContext = ourProducts
        .map(
          (p) =>
            `${p.name} (${p.year ?? 'NV'}) by ${p.producer ?? 'Unknown'} — ${p.offerPrice ? `${p.offerPrice} ${p.offerCurrency}` : 'no offer'}${p.lwin18 ? ` [LWIN: ${p.lwin18}]` : ''}`,
        )
        .join('\n');

      const stockContext = stockSummary
        .map((s) => `${s.productName} [${s.lwin18}]: ${s.totalCases} cases available`)
        .join('\n');

      // 5. Call Claude
      const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

      const result = await generateObject({
        model: anthropic('claude-sonnet-4-5-20250929'),
        schema: scoutOutputSchema,
        system: `You are The Scout, a competitive intelligence analyst for Craft & Culture, a wine distributor in the UAE/GCC market.

Your job is to analyze competitor wine lists against our own catalog and pricing, identify pricing gaps, blind spots (wines they carry that we don't), and generate actionable recommendations.

Key context:
- Prices are in AED (UAE Dirham) or USD
- 1 USD ≈ 3.67 AED
- A "blind spot" means a competitor carries a wine we don't have in our catalog at all
- Match products using LWIN codes when available, otherwise by name/vintage similarity
- Focus on commercially significant gaps (>10% price difference)
- Prioritize high-value wines and popular regions (Burgundy, Bordeaux, Champagne, Tuscany, Piedmont)`,
        messages: [
          {
            role: 'user',
            content: `Analyze today's competitive landscape.

COMPETITOR WINE LISTS (${competitors.length} wines):
${competitorContext}

OUR CATALOG (${ourProducts.length} products):
${ourCatalogContext}

OUR CURRENT STOCK (${stockSummary.length} SKUs):
${stockContext}

Generate a daily Scout brief with:
1. Executive summary (2-3 sentences)
2. Top price gaps (where competitors undercut or overcharge vs us)
3. Blind spots (competitor wines we don't carry)
4. Prioritized action items`,
          },
        ],
      });

      // 6. Build markdown content
      const data = result.object;
      const markdown = buildScoutMarkdown(data);

      // 7. Store output
      await triggerDb.insert(agentOutputs).values({
        agentId: 'scout',
        runId: run.id,
        type: 'daily-brief',
        title: `Scout Brief — ${new Date().toISOString().slice(0, 10)}`,
        content: markdown,
        data: data as Record<string, unknown>,
      });

      // 8. Complete run
      await triggerDb
        .update(agentRuns)
        .set({ status: 'completed', completedAt: new Date() })
        .where(eq(agentRuns.id, run.id));

      logger.info('Scout daily brief complete', {
        priceGaps: data.priceGaps.length,
        blindSpots: data.blindSpots.length,
        actionItems: data.actionItems.length,
      });

      return {
        success: true,
        priceGaps: data.priceGaps.length,
        blindSpots: data.blindSpots.length,
        actionItems: data.actionItems.length,
      };
    } catch (error) {
      logger.error('Scout agent failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      await triggerDb
        .update(agentRuns)
        .set({
          status: 'failed',
          completedAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        .where(eq(agentRuns.id, run.id));

      return { success: false, error: String(error) };
    }
  },
});
