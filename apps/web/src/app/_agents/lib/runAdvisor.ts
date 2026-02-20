import { createAnthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { and, desc, eq, gte, inArray, lt, not, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  agentOutputs,
  agentRuns,
  privateClientContacts,
  privateClientOrders,
  wmsDispatchBatches,
  wmsStock,
  zohoInvoices,
} from '@/database/schema';

const advisorOutputSchema = z.object({
  executiveSummary: z.string(),
  kpiSnapshot: z.object({
    revenueThisMonthUsd: z.number(),
    revenueTrend: z.string(),
    openOrders: z.number(),
    overdueInvoicesUsd: z.number(),
    stockCasesTotal: z.number(),
    dispatchPending: z.number(),
  }),
  risks: z.array(
    z.object({
      severity: z.enum(['high', 'medium', 'low']),
      title: z.string(),
      description: z.string(),
      suggestedAction: z.string(),
    }),
  ),
  opportunities: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      estimatedImpactUsd: z.number(),
      suggestedAction: z.string(),
    }),
  ),
  agentSynthesis: z.array(
    z.object({
      agentId: z.string(),
      keyTakeaway: z.string(),
    }),
  ),
  weeklyFocus: z.array(
    z.object({
      priority: z.number(),
      focus: z.string(),
      rationale: z.string(),
    }),
  ),
});

const buildMarkdown = (data: z.infer<typeof advisorOutputSchema>) => {
  const lines: string[] = [];
  lines.push('## Executive Summary\n');
  lines.push(data.executiveSummary, '');

  lines.push('## KPI Snapshot\n');
  lines.push(
    `| Metric | Value |`,
  );
  lines.push('|--------|-------|');
  lines.push(
    `| Revenue This Month | $${data.kpiSnapshot.revenueThisMonthUsd.toLocaleString()} |`,
  );
  lines.push(`| Revenue Trend | ${data.kpiSnapshot.revenueTrend} |`);
  lines.push(`| Open Orders | ${data.kpiSnapshot.openOrders} |`);
  lines.push(
    `| Overdue Invoices | $${data.kpiSnapshot.overdueInvoicesUsd.toLocaleString()} |`,
  );
  lines.push(
    `| Stock (Total Cases) | ${data.kpiSnapshot.stockCasesTotal.toLocaleString()} |`,
  );
  lines.push(`| Dispatch Pending | ${data.kpiSnapshot.dispatchPending} |`);
  lines.push('');

  if (data.risks.length > 0) {
    lines.push('## Risks\n');
    for (const risk of data.risks) {
      const severity =
        risk.severity === 'high'
          ? '!!!'
          : risk.severity === 'medium'
            ? '!!'
            : '!';
      lines.push(`### [${severity}] ${risk.title}`);
      lines.push(risk.description);
      lines.push(`**Action:** ${risk.suggestedAction}\n`);
    }
  }

  if (data.opportunities.length > 0) {
    lines.push('## Opportunities\n');
    for (const opp of data.opportunities) {
      lines.push(
        `- **${opp.title}** (~$${opp.estimatedImpactUsd.toLocaleString()}) — ${opp.description}. _Action: ${opp.suggestedAction}_`,
      );
    }
    lines.push('');
  }

  if (data.agentSynthesis.length > 0) {
    lines.push('## Agent Synthesis\n');
    for (const agent of data.agentSynthesis) {
      lines.push(`- **${agent.agentId}:** ${agent.keyTakeaway}`);
    }
    lines.push('');
  }

  if (data.weeklyFocus.length > 0) {
    lines.push('## Weekly Focus\n');
    for (const item of data.weeklyFocus) {
      lines.push(`${item.priority}. **${item.focus}** — _${item.rationale}_`);
    }
  }

  return lines.join('\n');
};

/** Run Advisor strategic intelligence directly (no Trigger.dev dependency) */
const runAdvisor = async () => {
  const [run] = await db
    .insert(agentRuns)
    .values({ agentId: 'advisor', status: 'running' })
    .returning({ id: agentRuns.id });

  if (!run) throw new Error('Failed to create agent run');

  try {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const revenueStatuses = [
      'sent',
      'viewed',
      'overdue',
      'paid',
      'partially_paid',
    ];

    // Run all independent queries in parallel
    const [
      revenueThisMonthResult,
      revenueLastMonthResult,
      ordersByStatusResult,
      overdueResult,
      stockTotalResult,
      dispatchResult,
      totalContactsResult,
    ] = await Promise.all([
      // Revenue this month
      db
        .select({
          total: sql<number>`coalesce(sum(${zohoInvoices.total}), 0)`,
        })
        .from(zohoInvoices)
        .where(
          and(
            inArray(zohoInvoices.status, revenueStatuses),
            gte(zohoInvoices.invoiceDate, thisMonthStart),
          ),
        ),

      // Revenue last month
      db
        .select({
          total: sql<number>`coalesce(sum(${zohoInvoices.total}), 0)`,
        })
        .from(zohoInvoices)
        .where(
          and(
            inArray(zohoInvoices.status, revenueStatuses),
            gte(zohoInvoices.invoiceDate, lastMonthStart),
            lt(zohoInvoices.invoiceDate, thisMonthStart),
          ),
        ),

      // Orders grouped by status (excluding draft/cancelled)
      db
        .select({
          status: privateClientOrders.status,
          count: sql<number>`count(*)`,
        })
        .from(privateClientOrders)
        .where(
          not(
            inArray(privateClientOrders.status, ['draft', 'cancelled']),
          ),
        )
        .groupBy(privateClientOrders.status),

      // Overdue invoices
      db
        .select({
          total: sql<number>`coalesce(sum(${zohoInvoices.balance}), 0)`,
        })
        .from(zohoInvoices)
        .where(eq(zohoInvoices.status, 'overdue')),

      // Total available cases
      db
        .select({
          total: sql<number>`coalesce(sum(${wmsStock.availableCases}), 0)`,
        })
        .from(wmsStock),

      // Dispatch batches grouped by status
      db
        .select({
          status: wmsDispatchBatches.status,
          count: sql<number>`count(*)`,
        })
        .from(wmsDispatchBatches)
        .groupBy(wmsDispatchBatches.status),

      // Total private client contacts
      db
        .select({
          count: sql<number>`count(*)`,
        })
        .from(privateClientContacts),
    ]);

    const revenueThisMonth = revenueThisMonthResult[0]?.total ?? 0;
    const revenueLastMonth = revenueLastMonthResult[0]?.total ?? 0;
    const overdueUsd = overdueResult[0]?.total ?? 0;
    const stockCasesTotal = stockTotalResult[0]?.total ?? 0;
    const totalContacts = totalContactsResult[0]?.count ?? 0;

    const openOrders = ordersByStatusResult.reduce(
      (sum, row) => sum + Number(row.count),
      0,
    );

    const pendingDispatchStatuses = ['draft', 'picking', 'staged'];
    const dispatchPending = dispatchResult
      .filter((row) =>
        pendingDispatchStatuses.includes(row.status ?? ''),
      )
      .reduce((sum, row) => sum + Number(row.count), 0);

    // Fetch latest agent briefs for synthesis
    const agentIds = ['scout', 'concierge', 'storyteller', 'buyer', 'pricer'];
    const agentSummaries: Array<{
      agentId: string;
      summary: string;
    }> = [];

    for (const agentId of agentIds) {
      const [latest] = await db
        .select({
          data: agentOutputs.data,
        })
        .from(agentOutputs)
        .where(eq(agentOutputs.agentId, agentId))
        .orderBy(desc(agentOutputs.createdAt))
        .limit(1);

      if (latest?.data) {
        const outputData = latest.data as Record<string, unknown>;
        const summary =
          typeof outputData.executiveSummary === 'string'
            ? outputData.executiveSummary
            : 'No summary available';
        agentSummaries.push({ agentId, summary });
      }
    }

    // Build context strings
    const revenueTrendPct =
      revenueLastMonth > 0
        ? (
            ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) *
            100
          ).toFixed(1)
        : 'N/A';

    const revenueTrendStr =
      revenueLastMonth > 0
        ? `${revenueThisMonth >= revenueLastMonth ? '+' : ''}${revenueTrendPct}% vs last month`
        : 'No prior month data';

    const orderStatusCtx = ordersByStatusResult
      .map((row) => `  ${row.status}: ${row.count}`)
      .join('\n');

    const dispatchCtx = dispatchResult
      .map((row) => `  ${row.status}: ${row.count}`)
      .join('\n');

    const agentCtx =
      agentSummaries.length > 0
        ? agentSummaries
            .map((a) => `**${a.agentId}:** ${a.summary}`)
            .join('\n\n')
        : 'No agent briefs available yet.';

    const anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });

    const result = await generateObject({
      model: anthropic('claude-sonnet-4-5-20250929'),
      schema: advisorOutputSchema,
      system: `You are The Advisor, a strategic business intelligence agent for Craft & Culture (C&C), a wine distributor in the UAE/GCC market.

You synthesize insights from all other agents (Scout, Concierge, Storyteller, Buyer, Pricer) plus financial and operational data to produce a weekly strategic brief.

Think like a CEO's chief of staff — what are the key risks, opportunities, and priorities this week?

Guidelines:
- Focus on actionable, high-impact recommendations
- Consider cash flow health (overdue invoices vs revenue)
- Monitor inventory levels — too high means tied-up capital, too low means lost sales
- Track sales pipeline from order volume and status distribution
- Synthesize agent insights into a unified strategic picture
- Be direct and specific — name the action, the number, the timeline
- Prioritize ruthlessly — the weekly focus should have no more than 5 items
- Today's date: ${now.toISOString().slice(0, 10)}`,
      messages: [
        {
          role: 'user',
          content: `Generate this week's strategic Advisor brief for Craft & Culture.

FINANCIAL DATA:
- Revenue this month: $${revenueThisMonth.toFixed(2)} USD
- Revenue last month: $${revenueLastMonth.toFixed(2)} USD
- Revenue trend: ${revenueTrendStr}
- Overdue invoices: $${overdueUsd.toFixed(2)} USD

ORDER PIPELINE (excluding draft/cancelled):
${orderStatusCtx || 'No active orders.'}
Total open orders: ${openOrders}

WAREHOUSE:
- Total stock: ${stockCasesTotal} cases available
- Dispatch batches by status:
${dispatchCtx || '  No dispatch batches.'}
- Pending dispatch (draft/picking/staged): ${dispatchPending}

CLIENTS:
- Total private client contacts: ${totalContacts}

AGENT SUMMARIES (latest briefs from each agent):
${agentCtx}

Generate:
1. Executive summary (3-5 sentences covering the overall business health)
2. KPI snapshot with revenue trend description
3. Top risks ranked by severity — cash flow, inventory, operational, competitive
4. Opportunities with estimated USD impact
5. Agent synthesis — one key takeaway from each agent's latest brief
6. Weekly focus — up to 5 prioritized actions for the week ahead`,
        },
      ],
    });

    const data = result.object;
    const markdown = buildMarkdown(data);

    await db.insert(agentOutputs).values({
      agentId: 'advisor',
      runId: run.id,
      type: 'weekly-brief',
      title: `Advisor Brief — ${now.toISOString().slice(0, 10)}`,
      content: markdown,
      data: data as Record<string, unknown>,
    });

    await db
      .update(agentRuns)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(agentRuns.id, run.id));

    return {
      success: true,
      risks: data.risks.length,
      opportunities: data.opportunities.length,
      weeklyFocus: data.weeklyFocus.length,
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

export default runAdvisor;
