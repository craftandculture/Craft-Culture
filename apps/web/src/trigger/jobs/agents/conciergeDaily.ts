import { createAnthropic } from '@ai-sdk/anthropic';
import { logger, schedules } from '@trigger.dev/sdk';
import { generateObject } from 'ai';
import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import {
  agentOutputs,
  agentRuns,
  privateClientContacts,
  privateClientOrderItems,
  privateClientOrders,
  wmsStock,
} from '@/database/schema';
import triggerDb from '@/trigger/triggerDb';

/**
 * Structured output schema for The Concierge's daily brief
 */
const conciergeOutputSchema = z.object({
  executiveSummary: z.string().describe('2-3 sentence overview of client engagement status'),
  hotLeads: z
    .array(
      z.object({
        clientName: z.string(),
        reason: z.string().describe('Why this client is a hot lead right now'),
        suggestedAction: z.string(),
        suggestedMessage: z.string().describe('Draft WhatsApp/email message to send'),
      }),
    )
    .describe('Clients who should be contacted today based on recent activity or timing'),
  dormantClients: z
    .array(
      z.object({
        clientName: z.string(),
        lastOrderDate: z.string().optional(),
        daysSinceOrder: z.number(),
        reEngagementIdea: z.string(),
      }),
    )
    .describe('Clients who have not ordered recently and need re-engagement'),
  upsellOpportunities: z
    .array(
      z.object({
        clientName: z.string(),
        previousPurchases: z.string().describe('Summary of what they typically buy'),
        suggestion: z.string().describe('What to recommend based on their taste profile and current stock'),
      }),
    )
    .describe('Cross-sell and upsell opportunities based on purchase history and available stock'),
});

/**
 * Build a readable markdown brief from Concierge output data
 */
const buildConciergeMarkdown = (data: z.infer<typeof conciergeOutputSchema>) => {
  const lines: string[] = [];

  lines.push('## Executive Summary\n');
  lines.push(data.executiveSummary);
  lines.push('');

  if (data.hotLeads.length > 0) {
    lines.push('## Hot Leads\n');
    for (const lead of data.hotLeads) {
      lines.push(`### ${lead.clientName}`);
      lines.push(`**Why now:** ${lead.reason}`);
      lines.push(`**Action:** ${lead.suggestedAction}`);
      lines.push(`\n> ${lead.suggestedMessage}\n`);
    }
  }

  if (data.dormantClients.length > 0) {
    lines.push('## Dormant Clients\n');
    lines.push('| Client | Last Order | Days Ago | Re-engagement Idea |');
    lines.push('|--------|-----------|----------|-------------------|');
    for (const client of data.dormantClients) {
      lines.push(
        `| ${client.clientName} | ${client.lastOrderDate ?? 'Never'} | ${client.daysSinceOrder} | ${client.reEngagementIdea} |`,
      );
    }
    lines.push('');
  }

  if (data.upsellOpportunities.length > 0) {
    lines.push('## Upsell Opportunities\n');
    for (const opp of data.upsellOpportunities) {
      lines.push(`- **${opp.clientName}** — Buys: ${opp.previousPurchases}. _Suggest: ${opp.suggestion}_`);
    }
  }

  return lines.join('\n');
};

/**
 * The Concierge — Daily client outreach agent
 *
 * Analyzes private client contacts, order history, and current stock
 * to generate personalized outreach suggestions and re-engagement prompts.
 *
 * Runs daily at 06:15 GST (after Scout).
 */
export const conciergeDailyJob = schedules.task({
  id: 'concierge-daily',
  cron: {
    pattern: '15 6 * * *',
    timezone: 'Asia/Dubai',
  },
  async run() {
    logger.info('Concierge agent starting daily analysis');

    const [run] = await triggerDb
      .insert(agentRuns)
      .values({ agentId: 'concierge', status: 'running' })
      .returning({ id: agentRuns.id });

    if (!run) {
      logger.error('Failed to create agent run');
      return { success: false };
    }

    try {
      // 1. Fetch private client contacts
      const contacts = await triggerDb
        .select({
          id: privateClientContacts.id,
          name: privateClientContacts.name,
          email: privateClientContacts.email,
          phone: privateClientContacts.phone,
          winePreferences: privateClientContacts.winePreferences,
          city: privateClientContacts.city,
        })
        .from(privateClientContacts)
        .limit(50);

      if (contacts.length === 0) {
        logger.warn('No private client contacts found — skipping Concierge run');
        await triggerDb
          .update(agentRuns)
          .set({ status: 'completed', completedAt: new Date() })
          .where(eq(agentRuns.id, run.id));
        return { success: true, skipped: true, reason: 'no_contacts' };
      }

      // 2. Fetch recent orders (last 90 days) with client names
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const recentOrders = await triggerDb
        .select({
          id: privateClientOrders.id,
          clientName: privateClientOrders.clientName,
          orderNumber: privateClientOrders.orderNumber,
          totalUsd: privateClientOrders.totalUsd,
          status: privateClientOrders.status,
          createdAt: privateClientOrders.createdAt,
        })
        .from(privateClientOrders)
        .orderBy(desc(privateClientOrders.createdAt))
        .limit(100);

      // 3. Fetch order items for recent orders to understand purchase patterns
      const orderIds = recentOrders.map((o) => o.id);
      let orderItems: Array<{
        orderId: string;
        productName: string | null;
        producer: string | null;
        region: string | null;
        vintage: string | null;
        quantity: number;
      }> = [];

      if (orderIds.length > 0) {
        orderItems = await triggerDb
          .select({
            orderId: privateClientOrderItems.orderId,
            productName: privateClientOrderItems.productName,
            producer: privateClientOrderItems.producer,
            region: privateClientOrderItems.region,
            vintage: privateClientOrderItems.vintage,
            quantity: privateClientOrderItems.quantity,
          })
          .from(privateClientOrderItems)
          .where(
            sql`${privateClientOrderItems.orderId} IN (${sql.join(
              orderIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          )
          .limit(200);
      }

      // 4. Fetch current available stock
      const availableStock = await triggerDb
        .select({
          productName: wmsStock.productName,
          producer: wmsStock.producer,
          vintage: wmsStock.vintage,
          availableCases: wmsStock.availableCases,
          lwin18: wmsStock.lwin18,
        })
        .from(wmsStock)
        .where(sql`${wmsStock.availableCases} > 0`)
        .limit(50);

      // 5. Build context
      const contactsContext = contacts
        .map(
          (c) =>
            `${c.name} (${c.city ?? 'Unknown city'})${c.winePreferences ? ` — Prefs: ${c.winePreferences}` : ''}${c.phone ? ` — Phone: ${c.phone}` : ''}`,
        )
        .join('\n');

      // Group orders by client
      const ordersByClient = new Map<string, typeof recentOrders>();
      for (const order of recentOrders) {
        const key = order.clientName ?? 'Unknown';
        const existing = ordersByClient.get(key) ?? [];
        existing.push(order);
        ordersByClient.set(key, existing);
      }

      const ordersContext = Array.from(ordersByClient.entries())
        .map(([client, orders]) => {
          const orderList = orders
            .map(
              (o) =>
                `  - ${o.orderNumber ?? o.id.slice(0, 8)}: ${o.totalUsd?.toFixed(0) ?? '?'} USD (${o.status}) — ${o.createdAt?.toISOString().slice(0, 10) ?? '?'}`,
            )
            .join('\n');
          return `${client}:\n${orderList}`;
        })
        .join('\n\n');

      // Build order items context for purchase pattern insights
      const orderItemsByClient = new Map<string, typeof orderItems>();
      for (const item of orderItems) {
        const order = recentOrders.find((o) => o.id === item.orderId);
        const key = order?.clientName ?? 'Unknown';
        const existing = orderItemsByClient.get(key) ?? [];
        existing.push(item);
        orderItemsByClient.set(key, existing);
      }

      const orderItemsContext = Array.from(orderItemsByClient.entries())
        .map(([client, items]) => {
          const itemList = items
            .map(
              (i) =>
                `  - ${i.productName ?? 'Unknown'} (${i.vintage ?? 'NV'}) x${i.quantity}`,
            )
            .join('\n');
          return `${client}:\n${itemList}`;
        })
        .join('\n\n');

      const stockContext = availableStock
        .map(
          (s) =>
            `${s.productName} (${s.vintage ?? 'NV'}) by ${s.producer ?? 'Unknown'} — ${s.availableCases} cases`,
        )
        .join('\n');

      // 6. Call Claude
      const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

      const result = await generateObject({
        model: anthropic('claude-sonnet-4-5-20250929'),
        schema: conciergeOutputSchema,
        system: `You are The Concierge, a luxury client relationship manager for Craft & Culture, a premium wine distributor in the UAE/GCC.

Your job is to analyze client contacts, their order history, and available inventory to suggest personalized outreach. You know Dubai's wine culture: private wine dinners, Ramadan gifting season, cooler-weather entertaining, and high-net-worth collector preferences.

Guidelines:
- Draft messages should be warm, professional, and personalized
- Consider seasonality (UAE events, holidays, weather)
- Flag clients who haven't ordered in 30+ days as re-engagement opportunities
- Suggest specific wines from current stock that match client preferences
- Today's date: ${new Date().toISOString().slice(0, 10)}`,
        messages: [
          {
            role: 'user',
            content: `Generate today's client outreach brief.

CLIENT CONTACTS (${contacts.length}):
${contactsContext}

RECENT ORDER HISTORY:
${ordersContext || 'No recent orders found.'}

PURCHASE DETAILS (what each client bought):
${orderItemsContext || 'No order items found.'}

AVAILABLE STOCK (${availableStock.length} SKUs):
${stockContext || 'No stock data available.'}

Generate:
1. Executive summary
2. Hot leads to contact today
3. Dormant clients needing re-engagement
4. Upsell/cross-sell opportunities`,
          },
        ],
      });

      // 7. Build markdown and store
      const data = result.object;
      const markdown = buildConciergeMarkdown(data);

      await triggerDb.insert(agentOutputs).values({
        agentId: 'concierge',
        runId: run.id,
        type: 'daily-brief',
        title: `Concierge Brief — ${new Date().toISOString().slice(0, 10)}`,
        content: markdown,
        data: data as Record<string, unknown>,
      });

      await triggerDb
        .update(agentRuns)
        .set({ status: 'completed', completedAt: new Date() })
        .where(eq(agentRuns.id, run.id));

      logger.info('Concierge daily brief complete', {
        hotLeads: data.hotLeads.length,
        dormant: data.dormantClients.length,
        upsells: data.upsellOpportunities.length,
      });

      return {
        success: true,
        hotLeads: data.hotLeads.length,
        dormant: data.dormantClients.length,
        upsells: data.upsellOpportunities.length,
      };
    } catch (error) {
      logger.error('Concierge agent failed', {
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
