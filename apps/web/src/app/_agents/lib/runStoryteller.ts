import { createAnthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { desc, eq, gt, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  agentConfigs,
  agentOutputs,
  agentRuns,
  competitorWines,
  privateClientOrders,
  products,
  wmsStock,
} from '@/database/schema';

const storytellerOutputSchema = z.object({
  executiveSummary: z.string(),
  instagramPosts: z.array(
    z.object({
      caption: z.string(),
      imagePrompt: z.string(),
      wineFeatured: z.string(),
      hook: z.string(),
    }),
  ),
  whatsappBlasts: z.array(
    z.object({
      subject: z.string(),
      body: z.string(),
      targetAudience: z.string(),
      callToAction: z.string(),
    }),
  ),
  linkedInPost: z.object({
    headline: z.string(),
    body: z.string(),
    topic: z.string(),
  }),
});

const buildMarkdown = (data: z.infer<typeof storytellerOutputSchema>) => {
  const lines: string[] = [];
  lines.push('## Weekly Content Theme\n');
  lines.push(data.executiveSummary, '');

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
 * Run Storyteller content generation directly (no Trigger.dev dependency)
 */
const runStoryteller = async () => {
  const [run] = await db
    .insert(agentRuns)
    .values({ agentId: 'storyteller', status: 'running' })
    .returning({ id: agentRuns.id });

  if (!run) throw new Error('Failed to create agent run');

  try {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const recentOrders = await db
      .select({
        clientName: privateClientOrders.clientName,
        totalUsd: privateClientOrders.totalUsd,
        createdAt: privateClientOrders.createdAt,
      })
      .from(privateClientOrders)
      .where(gt(privateClientOrders.createdAt, twoWeeksAgo))
      .orderBy(desc(privateClientOrders.createdAt))
      .limit(30);

    const featuredStock = await db
      .select({
        productName: wmsStock.productName,
        producer: wmsStock.producer,
        vintage: wmsStock.vintage,
        availableCases: wmsStock.availableCases,
        bottleSize: wmsStock.bottleSize,
      })
      .from(wmsStock)
      .where(gt(wmsStock.availableCases, 0))
      .orderBy(desc(wmsStock.availableCases))
      .limit(30);

    const catalog = await db
      .select({
        name: products.name,
        producer: products.producer,
        country: products.country,
        region: products.region,
        year: products.year,
      })
      .from(products)
      .limit(50);

    const competitorNames = await db
      .select({
        competitorName: competitorWines.competitorName,
        count: sql<number>`COUNT(*)`,
      })
      .from(competitorWines)
      .where(eq(competitorWines.isActive, true))
      .groupBy(competitorWines.competitorName)
      .limit(10);

    const stockCtx = featuredStock
      .map(
        (s) =>
          `${s.productName} (${s.vintage ?? 'NV'}) by ${s.producer ?? 'Unknown'} — ${s.availableCases} cases, ${s.bottleSize ?? '750ml'}`,
      )
      .join('\n');

    const catalogCtx = catalog
      .map(
        (p) =>
          `${p.name} by ${p.producer ?? 'Unknown'}, ${p.region ?? ''} ${p.country ?? ''} (${p.year ?? 'NV'})`,
      )
      .join('\n');

    const orderTrend = `${recentOrders.length} orders in the last 2 weeks`;

    const competitorCtx = competitorNames
      .map((c) => `${c.competitorName} (${c.count} wines)`)
      .join(', ');

    // Load Storyteller config (brand voice, content ideas, calendar context)
    const configRows = await db
      .select({
        configKey: agentConfigs.configKey,
        configValue: agentConfigs.configValue,
      })
      .from(agentConfigs)
      .where(eq(agentConfigs.agentId, 'storyteller'));

    const configMap = new Map(configRows.map((c) => [c.configKey, c.configValue]));
    const brandVoice = configMap.get('brand_voice') ?? '';
    const contentIdeas = configMap.get('content_ideas') ?? '';
    const calendarContext = configMap.get('calendar_context') ?? '';

    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const result = await generateObject({
      model: anthropic('claude-sonnet-4-5-20250929'),
      schema: storytellerOutputSchema,
      system: `You are Socials, a luxury wine marketing content creator for Craft & Culture, a premium wine distributor in the UAE/GCC market.

Your brand voice: sophisticated but approachable, knowledgeable without being pretentious, warm and inviting. You understand Dubai's luxury lifestyle, dining scene, and high-net-worth tastes.

Content guidelines:
- Instagram: Visual-first, lifestyle-focused, tell the story behind the wine
- WhatsApp: Concise, personal, include a clear call to action
- LinkedIn: Professional, thought leadership about the GCC wine market
- Reference specific wines from our inventory when possible
- Seasonal awareness: UAE weather, events (Art Dubai, F1, Dubai Food Festival), Ramadan
- Competitors exist but never mention them by name — focus on what makes C&C unique
- Today's date: ${new Date().toISOString().slice(0, 10)}${brandVoice ? `\n\nBRAND VOICE GUIDELINES:\n${brandVoice}` : ''}${contentIdeas ? `\n\nCONTENT IDEAS TO INCORPORATE:\n${contentIdeas}` : ''}${calendarContext ? `\n\nCALENDAR & CONTEXT:\n${calendarContext}` : ''}`,
      messages: [
        {
          role: 'user',
          content: `Generate this week's marketing content.

AVAILABLE INVENTORY (${featuredStock.length} SKUs):
${stockCtx || 'No stock data available.'}

PRODUCT CATALOG (${catalog.length} wines):
${catalogCtx || 'No catalog data available.'}

RECENT ACTIVITY: ${orderTrend}

MARKET CONTEXT: Competitors in market: ${competitorCtx || 'None uploaded yet'}

Generate:
1. 3 Instagram post ideas (with captions and image briefs)
2. 2 WhatsApp broadcast messages
3. 1 LinkedIn thought leadership post`,
        },
      ],
    });

    const data = result.object;
    const markdown = buildMarkdown(data);

    await db.insert(agentOutputs).values({
      agentId: 'storyteller',
      runId: run.id,
      type: 'weekly-content',
      title: `Socials Brief — Week of ${new Date().toISOString().slice(0, 10)}`,
      content: markdown,
      data: data as Record<string, unknown>,
    });

    await db
      .update(agentRuns)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(agentRuns.id, run.id));

    return {
      success: true,
      instagram: data.instagramPosts.length,
      whatsapp: data.whatsappBlasts.length,
      linkedin: 1,
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

export default runStoryteller;
