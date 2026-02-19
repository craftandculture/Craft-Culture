'use client';

import {
  IconAlertTriangle,
  IconChartBar,
  IconClock,
  IconRadar,
  IconRefresh,
  IconTargetArrow,
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
import Typography from '@/app/_ui/components/Typography/Typography';
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
  opportunity: { label: 'Opportunity', border: 'border-l-emerald-500', text: 'text-emerald-600' },
  market_move: { label: 'Market Move', border: 'border-l-amber-500', text: 'text-amber-600' },
  blind_spot: { label: 'Blind Spot', border: 'border-l-red-500', text: 'text-red-600' },
  fx_alert: { label: 'FX Alert', border: 'border-l-blue-500', text: 'text-blue-600' },
} as const;

/** Format a delta as "+N" or "-N" */
const formatDelta = (delta: number) => {
  if (delta === 0) return null;
  return delta > 0 ? `+${delta}` : `${delta}`;
};

/**
 * Renders the latest Scout agent brief with price gaps table, market signals, and action items
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
      <Card>
        <CardContent className="p-6">
          <Typography variant="bodySm" colorRole="muted">
            Loading Scout brief...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (!brief) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Typography variant="headingSm" className="mb-2">
            No Scout Brief Yet
          </Typography>
          <Typography variant="bodySm" colorRole="muted" className="mb-4">
            The Scout runs daily at 06:00 GST. Upload competitor wine lists in the Upload tab to
            enable competitive analysis.
          </Typography>
          <Button
            variant="primary"
            size="sm"
            onClick={() => triggerMutation.mutate({ agentId: 'scout' })}
            disabled={triggerMutation.isPending}
          >
            {triggerMutation.isPending ? 'Triggering...' : 'Run Now'}
          </Button>
          {triggerMutation.isSuccess && (
            <Typography variant="bodyXs" colorRole="muted" className="mt-2">
              Agent triggered. Results will appear shortly.
            </Typography>
          )}
        </CardContent>
      </Card>
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
  const prevActions = prevD?.actionItems ?? [];

  const priceGapDelta = prevBrief ? priceGaps.length - prevPriceGaps.length : null;
  const signalDelta = prevBrief ? signals.length - prevSignals.length : null;
  const actionDelta = prevBrief ? actionItems.length - prevActions.length : null;

  const prevRevenueAed = prevPriceGaps.reduce(
    (sum, g) => sum + Math.max(0, (g.competitorRetailAed ?? g.competitorPriceAed ?? 0) - (g.ourCostAed ?? g.ourPriceAed ?? 0)),
    0,
  );
  const revenueDelta = prevBrief && revenueAed > 0 && prevRevenueAed > 0
    ? Math.round(((revenueAed - prevRevenueAed) / prevRevenueAed) * 100)
    : null;

  const highCount = actionItems.filter((a) => a.priority === 'high').length;
  const medCount = actionItems.filter((a) => a.priority === 'medium').length;
  const prioritySub = [highCount && `${highCount} high`, medCount && `${medCount} med`]
    .filter(Boolean)
    .join(', ') || 'None';

  // History items (skip the first which is current)
  const historyItems = (outputs ?? []).slice(1);

  return (
    <div className="space-y-5">
      {/* Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Typography variant="headingSm">The Scout</Typography>
          <Typography variant="bodyXs" colorRole="muted">
            Competitive intelligence &amp; market monitoring
          </Typography>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-600" />
            Last run: {brief.createdAt.toLocaleString()}
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => triggerMutation.mutate({ agentId: 'scout' })}
            disabled={triggerMutation.isPending}
          >
            <IconRefresh size={16} className={`mr-1 ${triggerMutation.isPending ? 'animate-spin' : ''}`} />
            {triggerMutation.isPending ? 'Running...' : 'Run Scout'}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-start justify-between p-4">
            <div>
              <Typography variant="bodyXs" colorRole="muted" className="text-[11px] font-medium uppercase tracking-wider">
                Price Gaps
              </Typography>
              <Typography variant="headingLg" className="mt-1 text-emerald-600">
                {priceGaps.length}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" className="mt-0.5">
                {priceGapDelta !== null && formatDelta(priceGapDelta)
                  ? <span className={priceGapDelta > 0 ? 'text-emerald-600' : 'text-red-500'}>{formatDelta(priceGapDelta)} vs prev</span>
                  : 'found today'}
              </Typography>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <IconTrendingUp size={18} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start justify-between p-4">
            <div>
              <Typography variant="bodyXs" colorRole="muted" className="text-[11px] font-medium uppercase tracking-wider">
                Margin Potential
              </Typography>
              <Typography variant="headingLg" className="mt-1 text-text-brand">
                {revenueAed > 0 ? `AED ${Math.round(revenueAed / 1000)}k` : '\u2014'}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" className="mt-0.5">
                {revenueDelta !== null && revenueDelta !== 0
                  ? <span className={revenueDelta > 0 ? 'text-emerald-600' : 'text-red-500'}>{revenueDelta > 0 ? '+' : ''}{revenueDelta}% vs prev</span>
                  : revenueUsd > 0 ? `$${revenueUsd.toLocaleString()} USD` : 'No data'}
              </Typography>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-fill-brand/10 text-text-brand">
              <IconChartBar size={18} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start justify-between p-4">
            <div>
              <Typography variant="bodyXs" colorRole="muted" className="text-[11px] font-medium uppercase tracking-wider">
                Signals
              </Typography>
              <Typography variant="headingLg" className="mt-1 text-amber-600">
                {signals.length}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" className="mt-0.5">
                {signalDelta !== null && formatDelta(signalDelta)
                  ? <span className={signalDelta > 0 ? 'text-emerald-600' : 'text-red-500'}>{formatDelta(signalDelta)} vs prev</span>
                  : 'market observations'}
              </Typography>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <IconRadar size={18} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start justify-between p-4">
            <div>
              <Typography variant="bodyXs" colorRole="muted" className="text-[11px] font-medium uppercase tracking-wider">
                Action Items
              </Typography>
              <Typography variant="headingLg" className="mt-1 text-blue-600">
                {actionItems.length}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" className="mt-0.5">
                {actionDelta !== null && formatDelta(actionDelta)
                  ? <span className={actionDelta > 0 ? 'text-emerald-600' : 'text-red-500'}>{formatDelta(actionDelta)} vs prev</span>
                  : prioritySub}
              </Typography>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <IconTargetArrow size={18} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two-Column: Price Gaps Table + Market Signals */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[7fr_5fr]">
        {/* Price Gaps Table */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <Typography variant="bodySm" className="font-semibold">
                Margin Opportunities
              </Typography>
              {priceGaps.length > 0 && (
                <Badge colorRole="brand" size="xs">
                  {priceGaps.length} found
                </Badge>
              )}
            </div>
            {priceGaps.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow isHeaderRow>
                    <TableHead>Wine</TableHead>
                    <TableHead>Competitor Retail</TableHead>
                    <TableHead>Our IB Cost</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {priceGaps.slice(0, 8).map((gap, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <span className="font-semibold">{gap.productName}</span>
                      </TableCell>
                      <TableCell>
                        <div>{(gap.competitorRetailAed ?? gap.competitorPriceAed ?? 0).toFixed(0)} AED</div>
                        <Typography variant="bodyXs" colorRole="muted">
                          {gap.competitorName}
                        </Typography>
                      </TableCell>
                      <TableCell>{(gap.ourCostAed ?? gap.ourPriceAed ?? 0).toFixed(0)} AED</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          size="xs"
                          colorRole={
                            (gap.marginPercent ?? gap.gapPercent ?? 0) > 50
                              ? 'success'
                              : (gap.marginPercent ?? gap.gapPercent ?? 0) > 30
                                ? 'info'
                                : (gap.marginPercent ?? gap.gapPercent ?? 0) > 0
                                  ? 'warning'
                                  : 'danger'
                          }
                        >
                          {(gap.marginPercent ?? gap.gapPercent ?? 0).toFixed(0)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Typography variant="bodyXs" colorRole="muted">
                No price gaps detected.
              </Typography>
            )}
          </CardContent>
        </Card>

        {/* Market Signals */}
        <div className="flex flex-col gap-4">
          {/* Executive Summary */}
          {d?.executiveSummary && (
            <Card>
              <CardContent className="border-l-3 border-l-blue-500 p-4">
                <Typography variant="bodyXs" className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-blue-600">
                  Summary
                </Typography>
                <Typography variant="bodySm">
                  {d.executiveSummary}
                </Typography>
              </CardContent>
            </Card>
          )}

          {/* Signal cards with type-based styling */}
          {signals.map((signal, i) => {
            const config = signalConfig[signal.type];
            return (
              <Card key={i}>
                <CardContent className={`border-l-3 ${config.border} p-4`}>
                  <Typography variant="bodyXs" className={`mb-1 text-[10px] font-semibold uppercase tracking-wider ${config.text}`}>
                    {config.label}
                  </Typography>
                  <Typography variant="bodySm" className="font-semibold">
                    {signal.title}
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                    {signal.body}
                  </Typography>
                </CardContent>
              </Card>
            );
          })}

          {signals.length === 0 && !d?.executiveSummary && (
            <Card>
              <CardContent className="p-4">
                <Typography variant="bodyXs" colorRole="muted">
                  No market signals to display.
                </Typography>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Action Items */}
      {sortedActions.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <Typography variant="bodySm" className="font-semibold">
                Recommended Actions
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Sorted by priority
              </Typography>
            </div>
            <div className="flex flex-col divide-y divide-border-muted">
              {sortedActions.map((item, i) => (
                <div key={i} className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0">
                  <div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${priorityColor[item.priority]}`}
                  >
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Typography variant="bodySm" className="font-semibold">
                      {item.action}
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted" className="mt-0.5">
                      {item.rationale}
                    </Typography>
                  </div>
                  <Badge size="xs" colorRole={
                    item.priority === 'high' ? 'danger' : item.priority === 'medium' ? 'warning' : 'info'
                  }>
                    {item.priority}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Previous Briefs */}
      {historyItems.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <IconClock size={16} className="text-text-muted" />
              <Typography variant="bodySm" className="font-semibold">
                Previous Briefs
              </Typography>
            </div>
            <div className="flex flex-col divide-y divide-border-muted">
              {historyItems.map((item) => {
                const hd = item.data as ScoutData | null;
                const hGaps = hd?.priceGaps?.length ?? 0;
                const hSignals = (hd?.marketSignals ?? hd?.pricingOpportunities ?? []).length;
                const hActions = hd?.actionItems?.length ?? 0;
                return (
                  <div key={item.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <Typography variant="bodySm" className="font-medium">
                        {item.title}
                      </Typography>
                      <Typography variant="bodyXs" colorRole="muted">
                        {item.createdAt.toLocaleDateString()}
                      </Typography>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge size="xs" colorRole="brand">{hGaps} gaps</Badge>
                      <Badge size="xs" colorRole="warning">{hSignals} signals</Badge>
                      <Badge size="xs" colorRole="info">{hActions} actions</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alert for no data */}
      {!d && (
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <IconAlertTriangle size={18} className="text-amber-500" />
            <Typography variant="bodySm" colorRole="muted">
              Brief data could not be parsed. Raw content available below.
            </Typography>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ScoutBrief;
