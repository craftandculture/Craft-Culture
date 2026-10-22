import { createAnthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { and, desc, eq, gte, inArray, lt, not, sql } from 'drizzle-orm';
import { z } from 'zod';

import describeRevenuePace from '@/app/_agents/utils/describeRevenuePace';
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

/** A month at or above this is an excellent month for C&C (Kevin, Oct 2026) */
const STRONG_MONTH_USD = 150_000;

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
  wins: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
      }),
    )
    .describe('What is going well, with the number that shows it'),
  risks: z
    .array(
      z.object({
        severity: z.enum(['high', 'medium', 'low']),
        title: z.string(),
        description: z.string(),
        suggestedAction: z.string(),
      }),
    )
    .describe(
      'Improvements: things worth tightening up, framed constructively. high = do this week, medium = soon, low = when convenient',
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

type AdvisorOutput = z.infer<typeof advisorOutputSchema> & {
  kpiSnapshot: { revenueTrendDetail?: string };
};

const buildMarkdown = (data: AdvisorOutput) => {
  const lines: string[] = [];
  lines.push('## Executive Summary\n');
  lines.push(data.executiveSummary, '');

  lines.push('## KPI Snapshot\n');
  lines.push(`| Metric | Value |`);
  lines.push('|--------|-------|');
  lines.push(
    `| Revenue This Month | $${data.kpiSnapshot.revenueThisMonthUsd.toLocaleString()} |`,
  );
  lines.push(
    `| Revenue Trend | ${data.kpiSnapshot.revenueTrend}${data.kpiSnapshot.revenueTrendDetail ? ` (${data.kpiSnapshot.revenueTrendDetail})` : ''} |`,
  );
  lines.push(`| Open Orders | ${data.kpiSnapshot.openOrders} |`);
  lines.push(
    `| Overdue Invoices | $${data.kpiSnapshot.overdueInvoicesUsd.toLocaleString()} |`,
  );
  lines.push(
    `| Stock (Total Cases) | ${data.kpiSnapshot.stockCasesTotal.toLocaleString()} |`,
  );
  lines.push(`| Dispatch Pending | ${data.kpiSnapshot.dispatchPending} |`);
  lines.push('');

  if (data.wins.length > 0) {
    lines.push('## Wins\n');
    for (const win of data.wins) {
      lines.push(`- **${win.title}** — ${win.description}`);
    }
    lines.push('');
  }

  if (data.risks.length > 0) {
    lines.push('## Improvements\n');
    for (const risk of data.risks) {
      const timing =
        risk.severity === 'high'
          ? 'This week'
          : risk.severity === 'medium'
            ? 'Soon'
            : 'When convenient';
      lines.push(`### [${timing}] ${risk.title}`);
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
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1);
    const daysInLastMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
    ).getDate();
    // Exclusive end of "last month up to today's day of the month"
    const lastMonthSamePointEnd = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      Math.min(now.getDate(), daysInLastMonth) + 1,
    );

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
      revenueLastMonthToDateResult,
      revenueLastMonthResult,
      monthlyRevenueResult,
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

      // Revenue last month up to the same day of the month
      db
        .select({
          total: sql<number>`coalesce(sum(${zohoInvoices.total}), 0)`,
        })
        .from(zohoInvoices)
        .where(
          and(
            inArray(zohoInvoices.status, revenueStatuses),
            gte(zohoInvoices.invoiceDate, lastMonthStart),
            lt(zohoInvoices.invoiceDate, lastMonthSamePointEnd),
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

      // Complete months over the last year, to know the record
      db
        .select({
          month: sql<string>`to_char(${zohoInvoices.invoiceDate}, 'YYYY-MM')`,
          total: sql<number>`coalesce(sum(${zohoInvoices.total}), 0)`,
        })
        .from(zohoInvoices)
        .where(
          and(
            inArray(zohoInvoices.status, revenueStatuses),
            gte(zohoInvoices.invoiceDate, twelveMonthsAgo),
            lt(zohoInvoices.invoiceDate, thisMonthStart),
          ),
        )
        .groupBy(sql`to_char(${zohoInvoices.invoiceDate}, 'YYYY-MM')`)
        .orderBy(sql`to_char(${zohoInvoices.invoiceDate}, 'YYYY-MM')`),

      // Orders grouped by status (excluding draft/cancelled)
      db
        .select({
          status: privateClientOrders.status,
          count: sql<number>`count(*)`,
        })
        .from(privateClientOrders)
        .where(not(inArray(privateClientOrders.status, ['draft', 'cancelled'])))
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

    const revenueThisMonth = Number(revenueThisMonthResult[0]?.total ?? 0);
    const revenueLastMonthToDate = Number(
      revenueLastMonthToDateResult[0]?.total ?? 0,
    );
    const revenueLastMonth = Number(revenueLastMonthResult[0]?.total ?? 0);
    const overdueUsd = Number(overdueResult[0]?.total ?? 0);
    const stockCasesTotal = Number(stockTotalResult[0]?.total ?? 0);
    const totalContacts = Number(totalContactsResult[0]?.count ?? 0);

    const monthlyRevenue = monthlyRevenueResult.map((row) => ({
      month: row.month,
      total: Number(row.total),
    }));
    const bestMonth = monthlyRevenue.reduce<
      (typeof monthlyRevenue)[number] | null
    >(
      (best, row) => (best === null || row.total > best.total ? row : best),
      null,
    );
    const strongMonths = monthlyRevenue.filter(
      (row) => row.total >= STRONG_MONTH_USD,
    ).length;

    const pace = describeRevenuePace({
      now,
      revenueThisMonth,
      revenueLastMonthToDate,
      revenueLastMonth,
      bestMonthUsd: bestMonth?.total ?? null,
    });

    const openOrders = ordersByStatusResult.reduce(
      (sum, row) => sum + Number(row.count),
      0,
    );

    const pendingDispatchStatuses = ['draft', 'picking', 'staged'];
    const dispatchPending = dispatchResult
      .filter((row) => pendingDispatchStatuses.includes(row.status ?? ''))
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
      system: `You are Business, the weekly business brief for Craft & Culture (C&C), a wine distributor in the UAE/GCC market.

You bring together the other intelligence agents (Scout, Concierge, Socials, Purchasing, Pricing) and the financial and operational data into one weekly brief for the founders.

Context that must shape your reading:
- C&C is a young company that is growing well. Judge it against its own track record, not against mature competitors with decades of scale.
- A month at or above $${STRONG_MONTH_USD.toLocaleString('en-US')} revenue is an excellent month for C&C.
- This month is still in progress. Never compare month-to-date with a full previous month. The revenue comparison you are given is already like-for-like; use it as given.

Tone:
- Balanced and constructive, like a trusted chief of staff who is on the team's side. Lead with what is going well, then what to improve.
- Calm, professional language. Do not use words such as "crisis", "alarm", "emergency", "concerning", "broken", "blitz" or "mountain".
- Frame each risk as an improvement with a clear, proportionate next step. Reserve "high" for things that genuinely need doing this week.
- Be specific: name the number and the action. Do not invent figures you were not given.
- Keep the weekly focus to 5 items at most.
- Today's date: ${now.toISOString().slice(0, 10)}`,
      messages: [
        {
          role: 'user',
          content: `Generate this week's strategic Advisor brief for Craft & Culture.

FINANCIAL DATA:
- Revenue this month to date: $${revenueThisMonth.toFixed(2)} USD (${pace.daysLeft} days left in the month)
- Revenue last month at the same point: $${revenueLastMonthToDate.toFixed(2)} USD
- Revenue last month in full: $${revenueLastMonth.toFixed(2)} USD
- Like-for-like trend: ${pace.headline}; ${pace.detail}
- Best month in the last 12: ${bestMonth ? `${bestMonth.month}, $${bestMonth.total.toFixed(2)} USD` : 'no history yet'}${pace.isRecord ? ' (this month has already passed it)' : ''}
- Months at or above $${STRONG_MONTH_USD.toLocaleString('en-US')} in the last 12: ${strongMonths}
- Monthly revenue, last 12 complete months:
${monthlyRevenue.map((row) => `  ${row.month}: $${row.total.toFixed(0)}`).join('\n') || '  No history yet.'}
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
1. Executive summary (3-5 sentences): open with how the business is doing and its wins, then the main improvements
2. KPI snapshot (the figures are filled in from the data; give your best reading)
3. Wins — 2 to 4 things going well, each backed by a number
4. Improvements (the "risks" field) — cash collection, inventory, operations, pricing — ranked by when they need doing
5. Opportunities with estimated USD impact
6. Agent synthesis — one key takeaway from each agent's latest brief
7. Weekly focus — up to 5 prioritised actions for the week ahead`,
        },
      ],
    });

    // The figures come from the data, never from the model
    const data: AdvisorOutput = {
      ...result.object,
      kpiSnapshot: {
        revenueThisMonthUsd: revenueThisMonth,
        revenueTrend: pace.headline,
        revenueTrendDetail: pace.detail,
        openOrders,
        overdueInvoicesUsd: overdueUsd,
        stockCasesTotal,
        dispatchPending,
      },
    };
    const markdown = buildMarkdown(data);

    await db.insert(agentOutputs).values({
      agentId: 'advisor',
      runId: run.id,
      type: 'weekly-brief',
      title: `Business Brief — ${now.toISOString().slice(0, 10)}`,
      content: markdown,
      data: data as Record<string, unknown>,
    });

    await db
      .update(agentRuns)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(agentRuns.id, run.id));

    return {
      success: true,
      wins: data.wins.length,
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
