import { createAnthropic } from '@ai-sdk/anthropic';
import { logger, schedules } from '@trigger.dev/sdk';
import { generateObject } from 'ai';
import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import {
  agentOutputs,
  agentRuns,
  competitorWines,
  privateClientOrders,
  products,
  wmsStock,
} from '@/database/schema';
import triggerDb from '@/trigger/triggerDb';

/**
 * Structured output schema for The Storyteller's weekly content
 */
const storytellerOutputSchema = z.object({
  executiveSummary: z.string().describe('1-2 sentence overview of this week\'s content theme'),
  instagramPosts: z
    .array(
      z.object({
        caption: z.string().describe('Instagram caption with hashtags (max 2200 chars)'),
        imagePrompt: z.string().describe('Description for image generation or photo brief'),
        wineFeatured: z.string(),
        hook: z.string().describe('First line that hooks attention'),
      }),
    )
    .describe('3 Instagram post ideas for the week'),
  whatsappBlasts: z
    .array(
      z.object({
        subject: z.string().describe('Short subject line for the blast'),
        body: z.string().describe('WhatsApp message body (concise, with emojis)'),
        targetAudience: z.string().describe('Who should receive this'),
        callToAction: z.string(),
      }),
    )
    .describe('2 WhatsApp broadcast message ideas'),
  linkedInPost: z.object({
    headline: z.string().describe('LinkedIn post headline'),
    body: z.string().describe('LinkedIn post body (professional tone, 300-500 words)'),
    topic: z.string(),
  }).describe('1 LinkedIn thought leadership post'),
});

/**
 * Build a readable markdown brief from Storyteller output data
 */
const buildStorytellerMarkdown = (data: z.infer<typeof storytellerOutputSchema>) => {
  const lines: string[] = [];

  lines.push('## Weekly Content Theme\n');
  lines.push(data.executiveSummary);
  lines.push('');

  lines.push('## Instagram Posts\n');
  for (let i = 0; i < data.instagramPosts.length; i++) {
    const post = data.instagramPosts[i]!;
    lines.push(`### Post ${i + 1}: ${post.wineFeatured}`);
    lines.push(`**Hook:** ${post.hook}`);
    lines.push(`**Image brief:** ${post.imagePrompt}`);
    lines.push(`\n\`\`\`\n${post.caption}\n\`\`\`\n`);
  }

  lines.push('## WhatsApp Broadcasts\n');
  for (const blast of data.whatsappBlasts) {
    lines.push(`### ${blast.subject}`);
    lines.push(`**Target:** ${blast.targetAudience}`);
    lines.push(`**CTA:** ${blast.callToAction}`);
    lines.push(`\n> ${blast.body}\n`);
  }

  lines.push('## LinkedIn Post\n');
  lines.push(`### ${data.linkedInPost.headline}`);
  lines.push(`**Topic:** ${data.linkedInPost.topic}\n`);
  lines.push(data.linkedInPost.body);

  return lines.join('\n');
};

/**
 * The Storyteller — Weekly marketing content agent
 *
 * Generates social media content, WhatsApp blasts, and LinkedIn posts
 * based on available inventory, recent sales trends, and market positioning.
 *
 * Runs weekly on Monday at 06:05 GST.
 */
export const storytellerWeeklyJob = schedules.task({
  id: 'storyteller-weekly',
  cron: {
    pattern: '5 6 * * 1',
    timezone: 'Asia/Dubai',
  },
  async run() {
    logger.info('Storyteller agent starting weekly content generation');

    const [run] = await triggerDb
      .insert(agentRuns)
      .values({ agentId: 'storyteller', status: 'running' })
      .returning({ id: agentRuns.id });

    if (!run) {
      logger.error('Failed to create agent run');
      return { success: false };
    }

    try {
      // 1. Fetch recent orders for trending wines
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      const recentOrders = await triggerDb
        .select({
          clientName: privateClientOrders.clientName,
          totalUsd: privateClientOrders.totalUsd,
          createdAt: privateClientOrders.createdAt,
        })
        .from(privateClientOrders)
        .where(sql`${privateClientOrders.createdAt} > ${twoWeeksAgo}`)
        .orderBy(desc(privateClientOrders.createdAt))
        .limit(30);

      // 2. Fetch featured-worthy products (from current stock)
      const featuredStock = await triggerDb
        .select({
          productName: wmsStock.productName,
          producer: wmsStock.producer,
          vintage: wmsStock.vintage,
          availableCases: wmsStock.availableCases,
          lwin18: wmsStock.lwin18,
          bottleSize: wmsStock.bottleSize,
        })
        .from(wmsStock)
        .where(sql`${wmsStock.availableCases} > 0`)
        .orderBy(desc(wmsStock.availableCases))
        .limit(30);

      // 3. Fetch product catalog for richer descriptions
      const catalog = await triggerDb
        .select({
          name: products.name,
          producer: products.producer,
          country: products.country,
          region: products.region,
          year: products.year,
        })
        .from(products)
        .limit(50);

      // 4. Fetch competitor names for positioning context
      const competitorNames = await triggerDb
        .select({
          competitorName: competitorWines.competitorName,
          count: sql<number>`COUNT(*)`,
        })
        .from(competitorWines)
        .where(eq(competitorWines.isActive, true))
        .groupBy(competitorWines.competitorName)
        .limit(10);

      // 5. Build context
      const stockContext = featuredStock
        .map(
          (s) =>
            `${s.productName} (${s.vintage ?? 'NV'}) by ${s.producer ?? 'Unknown'} — ${s.availableCases} cases, ${s.bottleSize ?? '750ml'}`,
        )
        .join('\n');

      const catalogContext = catalog
        .map(
          (p) =>
            `${p.name} by ${p.producer ?? 'Unknown'}, ${p.region ?? ''} ${p.country ?? ''} (${p.year ?? 'NV'})`,
        )
        .join('\n');

      const orderTrend = `${recentOrders.length} orders in the last 2 weeks`;

      const competitorContext = competitorNames
        .map((c) => `${c.competitorName} (${c.count} wines)`)
        .join(', ');

      // 6. Call Claude
      const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

      const result = await generateObject({
        model: anthropic('claude-sonnet-4-5-20250929'),
        schema: storytellerOutputSchema,
        system: `You are The Storyteller, a luxury wine marketing content creator for Craft & Culture, a premium wine distributor in the UAE/GCC market.

Your brand voice: sophisticated but approachable, knowledgeable without being pretentious, warm and inviting. You understand Dubai's luxury lifestyle, dining scene, and high-net-worth tastes.

Content guidelines:
- Instagram: Visual-first, lifestyle-focused, tell the story behind the wine
- WhatsApp: Concise, personal, include a clear call to action
- LinkedIn: Professional, thought leadership about the GCC wine market
- Reference specific wines from our inventory when possible
- Seasonal awareness: UAE weather, events (Art Dubai, F1, Dubai Food Festival), Ramadan
- Competitors exist but never mention them by name — focus on what makes C&C unique
- Today's date: ${new Date().toISOString().slice(0, 10)}`,
        messages: [
          {
            role: 'user',
            content: `Generate this week's marketing content.

AVAILABLE INVENTORY (${featuredStock.length} SKUs):
${stockContext || 'No stock data available.'}

PRODUCT CATALOG (${catalog.length} wines):
${catalogContext || 'No catalog data available.'}

RECENT ACTIVITY: ${orderTrend}

MARKET CONTEXT: Competitors in market: ${competitorContext || 'None uploaded yet'}

Generate:
1. 3 Instagram post ideas (with captions and image briefs)
2. 2 WhatsApp broadcast messages
3. 1 LinkedIn thought leadership post`,
          },
        ],
      });

      // 7. Build markdown and store
      const data = result.object;
      const markdown = buildStorytellerMarkdown(data);

      await triggerDb.insert(agentOutputs).values({
        agentId: 'storyteller',
        runId: run.id,
        type: 'weekly-content',
        title: `Storyteller Brief — Week of ${new Date().toISOString().slice(0, 10)}`,
        content: markdown,
        data: data as Record<string, unknown>,
      });

      await triggerDb
        .update(agentRuns)
        .set({ status: 'completed', completedAt: new Date() })
        .where(eq(agentRuns.id, run.id));

      logger.info('Storyteller weekly content complete', {
        instagram: data.instagramPosts.length,
        whatsapp: data.whatsappBlasts.length,
        linkedin: 1,
      });

      return {
        success: true,
        instagram: data.instagramPosts.length,
        whatsapp: data.whatsappBlasts.length,
        linkedin: 1,
      };
    } catch (error) {
      logger.error('Storyteller agent failed', {
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
