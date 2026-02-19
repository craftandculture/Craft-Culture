'use client';

import {
  IconAlertTriangle,
  IconChartBar,
  IconEye,
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

interface ScoutData {
  executiveSummary?: string;
  priceGaps?: Array<{
    productName: string;
    ourCostAed: number;
    competitorRetailAed: number;
    competitorName: string;
    marginPercent: number;
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
}

const priorityOrder = { high: 0, medium: 1, low: 2 } as const;

const priorityColor = {
  high: 'bg-red-100 text-red-600',
  medium: 'bg-amber-100 text-amber-600',
  low: 'bg-blue-100 text-blue-600',
} as const;

/**
 * Renders the latest Scout agent brief with price gaps table, market signals, and action items
 */
const ScoutBrief = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    ...api.agents.getLatestBrief.queryOptions({ agentId: 'scout' }),
    refetchInterval: 60000,
  });

  const triggerMutation = useMutation({
    ...api.agents.triggerAgent.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: api.agents.getLatestBrief.queryKey({ agentId: 'scout' }),
      });
    },
  });

  const brief = data?.[0];

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
  const priceGaps = d?.priceGaps ?? [];
  const pricingOpps = d?.pricingOpportunities ?? [];
  const actionItems = d?.actionItems ?? [];
  const sortedActions = [...actionItems].sort(
    (a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2),
  );

  const revenueAed = priceGaps.reduce(
    (sum, g) => sum + Math.max(0, g.competitorRetailAed - g.ourCostAed),
    0,
  );
  const revenueUsd = Math.round(revenueAed / 3.67);

  const highCount = actionItems.filter((a) => a.priority === 'high').length;
  const medCount = actionItems.filter((a) => a.priority === 'medium').length;
  const prioritySub = [highCount && `${highCount} high`, medCount && `${medCount} med`]
    .filter(Boolean)
    .join(', ') || 'None';

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
                found today
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
                {revenueAed > 0 ? `AED ${Math.round(revenueAed / 1000)}k` : '—'}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" className="mt-0.5">
                {revenueUsd > 0 ? `$${revenueUsd.toLocaleString()} USD` : 'No data'}
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
                Price Opportunities
              </Typography>
              <Typography variant="headingLg" className="mt-1 text-amber-600">
                {pricingOpps.length}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" className="mt-0.5">
                Wines to source &amp; undercut
              </Typography>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <IconEye size={18} />
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
                {prioritySub}
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
                        <div>{gap.competitorRetailAed.toFixed(0)} AED</div>
                        <Typography variant="bodyXs" colorRole="muted">
                          {gap.competitorName}
                        </Typography>
                      </TableCell>
                      <TableCell>{gap.ourCostAed.toFixed(0)} AED</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          size="xs"
                          colorRole={
                            gap.marginPercent > 50
                              ? 'success'
                              : gap.marginPercent > 30
                                ? 'info'
                                : gap.marginPercent > 0
                                  ? 'warning'
                                  : 'danger'
                          }
                        >
                          {gap.marginPercent.toFixed(0)}%
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

          {/* Pricing Opportunities as signal cards */}
          {pricingOpps.map((opp, i) => (
            <Card key={i}>
              <CardContent className="border-l-3 border-l-amber-500 p-4">
                <Typography variant="bodyXs" className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-600">
                  Price Opportunity
                </Typography>
                <Typography variant="bodySm" className="font-semibold">
                  {opp.productName}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                  {opp.competitorName} at {opp.competitorPriceAed.toFixed(0)} AED
                  {opp.vintage ? ` (${opp.vintage})` : ''}
                  {opp.region ? ` — ${opp.region}` : ''}
                </Typography>
                <Typography variant="bodyXs" className="mt-1 text-emerald-600">
                  Est. cost {opp.estimatedCostAed.toFixed(0)} AED — ~{opp.potentialMarginPercent.toFixed(0)}% margin
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="mt-1 italic">
                  {opp.rationale}
                </Typography>
              </CardContent>
            </Card>
          ))}

          {pricingOpps.length === 0 && !d?.executiveSummary && (
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
