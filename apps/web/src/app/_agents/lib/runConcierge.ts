import { createAnthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  agentOutputs,
  agentRuns,
  privateClientContacts,
  privateClientOrderItems,
  privateClientOrders,
  wmsStock,
} from '@/database/schema';

const conciergeOutputSchema = z.object({
  executiveSummary: z.string(),
  hotLeads: z.array(
    z.object({
      clientName: z.string(),
      reason: z.string(),
      suggestedAction: z.string(),
      suggestedMessage: z.string(),
    }),
  ),
  dormantClients: z.array(
    z.object({
      clientName: z.string(),
      lastOrderDate: z.string().optional(),
      daysSinceOrder: z.number(),
      reEngagementIdea: z.string(),
    }),
  ),
  upsellOpportunities: z.array(
    z.object({
      clientName: z.string(),
      previousPurchases: z.string(),
      suggestion: z.string(),
    }),
  ),
});

const buildMarkdown = (data: z.infer<typeof conciergeOutputSchema>) => {
  const lines: string[] = [];
  lines.push('## Executive Summary\n');
  lines.push(data.executiveSummary, '');

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
      lines.push(
        `- **${opp.clientName}** — Buys: ${opp.previousPurchases}. _Suggest: ${opp.suggestion}_`,
      );
    }
  }

  return lines.join('\n');
};

/**
 * Run Concierge client analysis directly (no Trigger.dev dependency)
 */
const runConcierge = async () => {
  const [run] = await db
    .insert(agentRuns)
    .values({ agentId: 'concierge', status: 'running' })
    .returning({ id: agentRuns.id });

  if (!run) throw new Error('Failed to create agent run');

  try {
    const contacts = await db
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
      await db
        .update(agentRuns)
        .set({ status: 'completed', completedAt: new Date() })
        .where(eq(agentRuns.id, run.id));
      return { success: true, skipped: true, reason: 'no_contacts' };
    }

    const recentOrders = await db
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
      orderItems = await db
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

    const availableStock = await db
      .select({
        productName: wmsStock.productName,
        producer: wmsStock.producer,
        vintage: wmsStock.vintage,
        availableCases: wmsStock.availableCases,
      })
      .from(wmsStock)
      .where(sql`${wmsStock.availableCases} > 0`)
      .limit(50);

    const contactsCtx = contacts
      .map(
        (c) =>
          `${c.name} (${c.city ?? 'Unknown city'})${c.winePreferences ? ` — Prefs: ${c.winePreferences}` : ''}${c.phone ? ` — Phone: ${c.phone}` : ''}`,
      )
      .join('\n');

    const ordersByClient = new Map<string, typeof recentOrders>();
    for (const order of recentOrders) {
      const key = order.clientName ?? 'Unknown';
      const existing = ordersByClient.get(key) ?? [];
      existing.push(order);
      ordersByClient.set(key, existing);
    }

    const ordersCtx = Array.from(ordersByClient.entries())
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

    const orderItemsByClient = new Map<string, typeof orderItems>();
    for (const item of orderItems) {
      const order = recentOrders.find((o) => o.id === item.orderId);
      const key = order?.clientName ?? 'Unknown';
      const existing = orderItemsByClient.get(key) ?? [];
      existing.push(item);
      orderItemsByClient.set(key, existing);
    }

    const itemsCtx = Array.from(orderItemsByClient.entries())
      .map(([client, items]) => {
        const itemList = items
          .map(
            (i) => `  - ${i.productName ?? 'Unknown'} (${i.vintage ?? 'NV'}) x${i.quantity}`,
          )
          .join('\n');
        return `${client}:\n${itemList}`;
      })
      .join('\n\n');

    const stockCtx = availableStock
      .map(
        (s) =>
          `${s.productName} (${s.vintage ?? 'NV'}) by ${s.producer ?? 'Unknown'} — ${s.availableCases} cases`,
      )
      .join('\n');

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
${contactsCtx}

RECENT ORDER HISTORY:
${ordersCtx || 'No recent orders found.'}

PURCHASE DETAILS (what each client bought):
${itemsCtx || 'No order items found.'}

AVAILABLE STOCK (${availableStock.length} SKUs):
${stockCtx || 'No stock data available.'}

Generate:
1. Executive summary
2. Hot leads to contact today
3. Dormant clients needing re-engagement
4. Upsell/cross-sell opportunities`,
        },
      ],
    });

    const data = result.object;
    const markdown = buildMarkdown(data);

    await db.insert(agentOutputs).values({
      agentId: 'concierge',
      runId: run.id,
      type: 'daily-brief',
      title: `Concierge Brief — ${new Date().toISOString().slice(0, 10)}`,
      content: markdown,
      data: data as Record<string, unknown>,
    });

    await db
      .update(agentRuns)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(agentRuns.id, run.id));

    return {
      success: true,
      hotLeads: data.hotLeads.length,
      dormant: data.dormantClients.length,
      upsells: data.upsellOpportunities.length,
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

export default runConcierge;
