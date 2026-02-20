'use client';

import {
  IconAlertTriangle,
  IconChevronRight,
  IconEye,
  IconRadar,
  IconRefresh,
  IconSettings,
  IconStarFilled,
  IconTrendingUp,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Table from '@/app/_ui/components/Table/Table';
import TableBody from '@/app/_ui/components/Table/TableBody';
import TableCell from '@/app/_ui/components/Table/TableCell';
import TableHead from '@/app/_ui/components/Table/TableHead';
import TableHeader from '@/app/_ui/components/Table/TableHeader';
import TableRow from '@/app/_ui/components/Table/TableRow';
import useTRPC from '@/lib/trpc/browser';

interface MarketSignal {
  type: 'opportunity' | 'market_move' | 'blind_spot' | 'fx_alert';
  title: string;
  body: string;
  relatedProduct?: string;
}

interface ScoutData {
  executiveSummary?: string;
  priceGaps?: Array<{
    productName: string;
    ourCostAed?: number;
    ourPriceAed?: number;
    competitorRetailAed?: number;
    competitorPriceAed?: number;
    competitorName: string;
    marginPercent?: number;
    gapPercent?: number;
    recommendation: string;
  }>;
  pricingOpportunities?: Array<{
    productName: string;
    competitorName: string;
    competitorPriceAed: number;
    estimatedCostAed: number;
    potentialMarginPercent: number;
    region?: string;
    vintage?: string;
    rationale: string;
  }>;
  actionItems?: Array<{
    priority: 'high' | 'medium' | 'low';
    action: string;
    rationale: string;
  }>;
  marketSignals?: MarketSignal[];
}

const priorityOrder = { high: 0, medium: 1, low: 2 } as const;

const priorityColor = {
  high: 'bg-red-100 text-red-600',
  medium: 'bg-amber-100 text-amber-600',
  low: 'bg-blue-100 text-blue-600',
} as const;

const signalConfig = {
  opportunity: { label: 'Opportunity', border: 'border-l-emerald-600', text: 'text-emerald-600' },
  market_move: { label: 'Market Move', border: 'border-l-amber-600', text: 'text-amber-600' },
  blind_spot: { label: 'Blind Spot', border: 'border-l-red-600', text: 'text-red-600' },
  fx_alert: { label: 'FX Alert', border: 'border-l-blue-600', text: 'text-blue-600' },
} as const;

/** Format relative time from a date */
const formatRelativeTime = (date: Date) => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHrs < 1) return 'Just now';
  if (diffHrs < 24) return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

/**
 * Renders the latest Scout agent brief matching the wireframe design:
 * KPI cards, price gaps table, market signals, action items, and brief history
 */
const ScoutBrief = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const { data: outputs, isLoading } = useQuery({
    ...api.agents.getAgentOutputs.queryOptions({ agentId: 'scout', limit: 10 }),
    refetchInterval: 60000,
  });

  const triggerMutation = useMutation({
    ...api.agents.triggerAgent.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: api.agents.getAgentOutputs.queryKey({ agentId: 'scout', limit: 10 }),
      });
    },
  });

  const brief = outputs?.[0];
  const prevBrief = outputs?.[1];

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Skeleton header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="h-7 w-40 animate-pulse rounded-lg bg-surface-secondary" />
            <div className="mt-2 h-4 w-72 animate-pulse rounded bg-surface-secondary" />
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-32 animate-pulse rounded-full bg-surface-secondary" />
            <div className="h-8 w-24 animate-pulse rounded-lg bg-surface-secondary" />
          </div>
        </div>
        {/* Skeleton KPIs */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <Card key={n}>
              <CardContent className="p-4">
                <div className="h-4 w-20 animate-pulse rounded bg-surface-secondary" />
                <div className="mt-3 h-7 w-16 animate-pulse rounded bg-surface-secondary" />
                <div className="mt-2 h-3 w-24 animate-pulse rounded bg-surface-secondary" />
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Skeleton two-col */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[7fr_5fr]">
          <Card><CardContent className="h-64 animate-pulse p-6" /></Card>
          <Card><CardContent className="h-64 animate-pulse p-6" /></Card>
        </div>
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Market Scout</h1>
          <p className="mt-0.5 text-[13px] text-text-muted">
            Competitive intelligence &amp; market monitoring &mdash; runs daily at 06:00 GST
          </p>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <IconRadar size={40} className="mx-auto mb-3 text-text-muted" />
            <p className="text-base font-semibold">No Scout Brief Yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-text-muted">
              Market Scout runs daily at 06:00 GST. Upload competitor wine lists in the Upload tab to
              enable competitive analysis.
            </p>
            <Button
              variant="primary"
              size="sm"
              className="mt-4"
              onClick={() => triggerMutation.mutate({ agentId: 'scout' })}
              disabled={triggerMutation.isPending}
            >
              <IconRefresh size={16} className={triggerMutation.isPending ? 'animate-spin' : ''} />
              {triggerMutation.isPending ? 'Running...' : 'Run Now'}
            </Button>
            {triggerMutation.isSuccess && (
              <p className="mt-2 text-xs text-text-muted">
                Agent triggered. Results will appear shortly.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const d = brief.data as ScoutData | null;
  const prevD = prevBrief?.data as ScoutData | null;

  const priceGaps = d?.priceGaps ?? [];
  const actionItems = d?.actionItems ?? [];
  const sortedActions = [...actionItems].sort(
    (a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2),
  );

  // Build market signals — use new field if available, fall back to legacy pricingOpportunities
  const signals: MarketSignal[] = d?.marketSignals ?? (d?.pricingOpportunities ?? []).map((opp) => ({
    type: 'opportunity' as const,
    title: opp.productName,
    body: `${opp.competitorName} at ${opp.competitorPriceAed.toFixed(0)} AED${opp.vintage ? ` (${opp.vintage})` : ''}${opp.region ? ` — ${opp.region}` : ''}. Est. cost ${opp.estimatedCostAed.toFixed(0)} AED (~${opp.potentialMarginPercent.toFixed(0)}% margin). ${opp.rationale}`,
    relatedProduct: opp.productName,
  }));

  // Revenue opportunity from price gaps
  const revenueAed = priceGaps.reduce(
    (sum, g) => sum + Math.max(0, (g.competitorRetailAed ?? g.competitorPriceAed ?? 0) - (g.ourCostAed ?? g.ourPriceAed ?? 0)),
    0,
  );
  const revenueUsd = Math.round(revenueAed / 3.67);

  // KPI deltas vs previous brief
  const prevPriceGaps = prevD?.priceGaps ?? [];
  const prevSignals: MarketSignal[] = prevD?.marketSignals ?? (prevD?.pricingOpportunities ?? []).map((opp) => ({
    type: 'opportunity' as const,
    title: opp.productName,
    body: '',
  }));

  const priceGapDelta = prevBrief ? priceGaps.length - prevPriceGaps.length : null;

  // Blind spots count
  const blindSpots = signals.filter((s) => s.type === 'blind_spot').length;
  const prevBlindSpots = prevSignals.filter((s) => s.type === 'blind_spot').length;

  // Confidence score: heuristic based on data completeness
  const confidence = Math.min(100, Math.round(
    50
    + (priceGaps.length > 0 ? 15 : 0)
    + (signals.length > 0 ? 15 : 0)
    + (actionItems.length > 0 ? 10 : 0)
    + (d?.executiveSummary ? 10 : 0),
  ));

  // History items (skip the first which is current)
  const historyItems = (outputs ?? []).slice(1);

  return (
    <div className="space-y-6">
      {/* ── Page Header ──────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Market Scout</h1>
          <p className="mt-0.5 text-[13px] text-text-muted">
            Competitive intelligence &amp; market monitoring &mdash; runs daily at 06:00 GST
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-600" />
            Last run: {formatRelativeTime(brief.createdAt)}
          </div>
          <button
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-primary bg-surface-primary px-4 py-2 text-[13px] font-medium transition-colors hover:border-text-muted"
            onClick={() => triggerMutation.mutate({ agentId: 'scout' })}
            disabled={triggerMutation.isPending}
          >
            <IconRefresh size={15} className={triggerMutation.isPending ? 'animate-spin' : ''} />
            {triggerMutation.isPending ? 'Running...' : 'Run Now'}
          </button>
          <button className="inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-text-brand transition-opacity hover:opacity-80">
            <IconSettings size={15} />
            Configure
          </button>
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {/* Price Gaps Found */}
        <Card>
          <CardContent className="flex items-start justify-between p-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                Price Gaps Found
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">
                {priceGaps.length}
              </p>
              <p className="mt-0.5 text-[11px] text-text-muted">
                {priceGapDelta !== null && priceGapDelta !== 0
                  ? `vs ${prevPriceGaps.length} previous`
                  : 'found today'}
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <IconTrendingUp size={18} />
            </div>
          </CardContent>
        </Card>

        {/* Revenue Opportunity */}
        <Card>
          <CardContent className="flex items-start justify-between p-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                Revenue Opportunity
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-text-brand">
                {revenueAed > 0 ? `AED ${Math.round(revenueAed / 1000)}k` : '\u2014'}
              </p>
              <p className="mt-0.5 text-[11px] text-text-muted">
                {revenueUsd > 0 ? `$${revenueUsd.toLocaleString()} USD` : 'No data'}
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-fill-brand/10 text-text-brand">
              <IconStarFilled size={18} />
            </div>
          </CardContent>
        </Card>

        {/* Blind Spots */}
        <Card>
          <CardContent className="flex items-start justify-between p-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                Blind Spots
              </p>
              <p className={`mt-1 text-2xl font-semibold tracking-tight ${blindSpots > 0 ? 'text-amber-600' : ''}`}>
                {blindSpots}
              </p>
              <p className="mt-0.5 text-[11px] text-text-muted">
                {prevBrief && blindSpots !== prevBlindSpots
                  ? `vs ${prevBlindSpots} previous`
                  : blindSpots > 0
                    ? 'Categories to address'
                    : 'All clear'}
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <IconAlertTriangle size={18} />
            </div>
          </CardContent>
        </Card>

        {/* Confidence */}
        <Card>
          <CardContent className="flex items-start justify-between p-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                Confidence
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">
                {confidence}%
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 w-14 overflow-hidden rounded-full bg-border-muted">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-all"
                    style={{ width: `${confidence}%` }}
                  />
                </div>
                <span className="text-[11px] text-text-muted">
                  {confidence >= 80 ? 'High' : confidence >= 60 ? 'Medium' : 'Low'}
                </span>
              </div>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
              <IconEye size={18} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Two-Column: Price Gaps + Signals ──────── */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[7fr_5fr]">
        {/* Price Gaps Table */}
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold">Price Gaps vs Competitors</p>
              {priceGaps.length > 0 && (
                <span className="rounded-full bg-fill-brand/10 px-2.5 py-0.5 text-[11px] font-semibold text-text-brand">
                  {priceGaps.length} found
                </span>
              )}
            </div>
            {priceGaps.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow isHeaderRow>
                      <TableHead>Wine</TableHead>
                      <TableHead>Competitor</TableHead>
                      <TableHead>Your Price</TableHead>
                      <TableHead className="text-right">Gap</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {priceGaps.slice(0, 6).map((gap, i) => {
                      const gapPct = gap.marginPercent ?? gap.gapPercent ?? 0;
                      return (
                        <TableRow key={i}>
                          <TableCell>
                            <span className="font-semibold">{gap.productName}</span>
                            <p className="mt-0.5 text-[11px] text-text-muted">
                              {gap.competitorName}
                            </p>
                          </TableCell>
                          <TableCell className="tabular-nums">
                            AED {(gap.competitorRetailAed ?? gap.competitorPriceAed ?? 0).toLocaleString()}/btl
                          </TableCell>
                          <TableCell className="tabular-nums">
                            AED {(gap.ourCostAed ?? gap.ourPriceAed ?? 0).toLocaleString()}/btl
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${gapPct > 100 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                              +{Math.round(gapPct)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {priceGaps.length > 6 && (
                  <div className="mt-3 text-center">
                    <button className="text-[12px] font-medium text-text-brand transition-opacity hover:opacity-80">
                      View all {priceGaps.length} gaps &rarr;
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="py-8 text-center text-sm text-text-muted">
                No price gaps detected in this analysis.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Market Signals */}
        <div className="flex flex-col gap-5">
          <Card>
            <CardContent className="p-6">
              <p className="mb-4 text-sm font-semibold">Market Signals</p>
              {signals.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {signals.map((signal, i) => {
                    const config = signalConfig[signal.type];
                    return (
                      <div
                        key={i}
                        className={`rounded-lg border border-border-muted border-l-[3px] ${config.border} p-3.5`}
                      >
                        <p className={`text-[10px] font-semibold uppercase tracking-wider ${config.text}`}>
                          {config.label}
                        </p>
                        <p className="mt-1 text-[13px] font-semibold">{signal.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-text-muted">{signal.body}</p>
                      </div>
                    );
                  })}
                </div>
              ) : d?.executiveSummary ? (
                <div className="rounded-lg border border-border-muted border-l-[3px] border-l-blue-600 p-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">Summary</p>
                  <p className="mt-1 text-sm">{d.executiveSummary}</p>
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-text-muted">
                  No market signals detected.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Action Items ─────────────────────────── */}
      {sortedActions.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold">Recommended Actions</p>
              <span className="text-xs text-text-muted">Sorted by impact</span>
            </div>
            <div className="flex flex-col">
              {sortedActions.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 border-b border-border-muted py-3.5 last:border-b-0"
                >
                  <div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${priorityColor[item.priority]}`}
                  >
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold">{item.action}</p>
                    <p className="mt-0.5 text-xs text-text-muted">{item.rationale}</p>
                  </div>
                  <Badge
                    size="xs"
                    colorRole={
                      item.priority === 'high' ? 'danger' : item.priority === 'medium' ? 'warning' : 'info'
                    }
                    className="shrink-0"
                  >
                    {item.priority}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Previous Briefs ──────────────────────── */}
      {historyItems.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold">Previous Briefs</p>
              <button className="text-[12px] font-medium text-text-brand transition-opacity hover:opacity-80">
                View All &rarr;
              </button>
            </div>
            <div className="flex flex-col">
              {historyItems.map((item) => {
                const hd = item.data as ScoutData | null;
                const hGaps = hd?.priceGaps?.length ?? 0;
                const hSignals = hd?.marketSignals ?? hd?.pricingOpportunities ?? [];
                const hOpps = hSignals.filter((s: { type?: string }) => s.type === 'opportunity' || !s.type).length;
                const hAlerts = hSignals.filter((s: { type?: string }) => s.type === 'market_move' || s.type === 'fx_alert').length;
                const hBlinds = hSignals.filter((s: { type?: string }) => s.type === 'blind_spot').length;
                const date = item.createdAt;

                return (
                  <div
                    key={item.id}
                    className="group flex cursor-pointer items-center gap-3 border-b border-border-muted py-3 transition-colors last:border-b-0 hover:bg-surface-secondary/50"
                  >
                    {/* Date column */}
                    <div className="min-w-[48px] text-center">
                      <span className="block text-lg font-semibold leading-none">
                        {date.getDate()}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        {date.toLocaleString('en', { month: 'short' })}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold">{item.title}</p>
                      {hd?.executiveSummary && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-text-muted">
                          {hd.executiveSummary}
                        </p>
                      )}
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {hGaps > 0 && (
                          <span className="rounded-full bg-emerald-100 px-2 py-px text-[10px] font-semibold text-emerald-600">
                            {hGaps} gaps
                          </span>
                        )}
                        {hOpps > 0 && (
                          <span className="rounded-full bg-emerald-100 px-2 py-px text-[10px] font-semibold text-emerald-600">
                            {hOpps} opportunities
                          </span>
                        )}
                        {hAlerts > 0 && (
                          <span className="rounded-full bg-amber-100 px-2 py-px text-[10px] font-semibold text-amber-600">
                            {hAlerts} alerts
                          </span>
                        )}
                        {hBlinds > 0 && (
                          <span className="rounded-full bg-red-100 px-2 py-px text-[10px] font-semibold text-red-600">
                            {hBlinds} blind spots
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Chevron */}
                    <IconChevronRight
                      size={18}
                      className="shrink-0 text-text-muted opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alert for unparseable data */}
      {!d && (
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <IconAlertTriangle size={18} className="text-amber-500" />
            <p className="text-sm text-text-muted">
              Brief data could not be parsed. Raw content available below.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ScoutBrief;
