'use client';

import {
  IconArrowDown,
  IconArrowUp,
  IconCurrencyDollar,
  IconRefresh,
  IconScale,
  IconTarget,
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

interface PricerData {
  executiveSummary?: string;
  priceAdjustments?: Array<{
    lwin18?: string;
    productName: string;
    currentPriceUsd: number;
    suggestedPriceUsd: number;
    changePercent: number;
    reason: string;
    competitorContext: string;
    marginImpact: string;
  }>;
  marginAlerts?: Array<{
    productName: string;
    currentMarginPercent: number;
    targetMarginPercent: number;
    issue: string;
  }>;
  competitiveGaps?: Array<{
    productName: string;
    ourPriceAed: number;
    competitorPriceAed: number;
    competitorName: string;
    gapPercent: number;
  }>;
  actionItems?: Array<{
    priority: string;
    action: string;
    rationale: string;
  }>;
}

/**
 * Renders the latest Pricer agent brief with price adjustments, margin alerts, and competitive gaps
 */
const PricerBrief = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    ...api.agents.getLatestBrief.queryOptions({ agentId: 'pricer' }),
    refetchInterval: 60000,
  });

  const triggerMutation = useMutation({
    ...api.agents.triggerAgent.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: api.agents.getLatestBrief.queryKey({ agentId: 'pricer' }),
      });
    },
  });

  const brief = data?.[0];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Typography variant="bodySm" colorRole="muted">
            Loading Pricer brief...
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
            No Pricer Brief Yet
          </Typography>
          <Typography variant="bodySm" colorRole="muted" className="mb-4">
            The Pricer runs daily at 06:45 GST. It analyzes competitive pricing, margins, and
            stock velocity to optimize your pricing strategy.
          </Typography>
          <Button
            variant="primary"
            size="sm"
            onClick={() => triggerMutation.mutate({ agentId: 'pricer' })}
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

  const d = brief.data as PricerData | null;
  const adjustments = d?.priceAdjustments ?? [];
  const marginAlerts = d?.marginAlerts ?? [];
  const gaps = d?.competitiveGaps ?? [];
  const actionItems = d?.actionItems ?? [];

  const increases = adjustments.filter((a) => a.changePercent > 0).length;
  const decreases = adjustments.filter((a) => a.changePercent < 0).length;

  return (
    <div className="space-y-5">
      {/* Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Typography variant="headingSm">The Pricer</Typography>
          <Typography variant="bodyXs" colorRole="muted">
            Dynamic pricing optimization &amp; margin analysis
          </Typography>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-600" />
            Last run: {brief.createdAt.toLocaleString()}
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <IconRefresh size={16} className="mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="flex items-start justify-between p-4">
            <div>
              <Typography variant="bodyXs" colorRole="muted" className="text-[11px] font-medium uppercase tracking-wider">
                Price Adjustments
              </Typography>
              <Typography variant="headingLg" className="mt-1 text-violet-600">
                {adjustments.length}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" className="mt-0.5">
                Suggested changes
              </Typography>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
              <IconCurrencyDollar size={18} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start justify-between p-4">
            <div>
              <Typography variant="bodyXs" colorRole="muted" className="text-[11px] font-medium uppercase tracking-wider">
                Increase
              </Typography>
              <Typography variant="headingLg" className="mt-1 text-emerald-600">
                {increases}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" className="mt-0.5">
                Underpriced SKUs
              </Typography>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <IconArrowUp size={18} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start justify-between p-4">
            <div>
              <Typography variant="bodyXs" colorRole="muted" className="text-[11px] font-medium uppercase tracking-wider">
                Decrease
              </Typography>
              <Typography variant="headingLg" className="mt-1 text-amber-600">
                {decreases}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" className="mt-0.5">
                Overpriced SKUs
              </Typography>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <IconArrowDown size={18} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start justify-between p-4">
            <div>
              <Typography variant="bodyXs" colorRole="muted" className="text-[11px] font-medium uppercase tracking-wider">
                Margin Alerts
              </Typography>
              <Typography variant="headingLg" className="mt-1 text-red-600">
                {marginAlerts.length}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" className="mt-0.5">
                Below target
              </Typography>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600">
              <IconTarget size={18} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Executive Summary */}
      {d?.executiveSummary && (
        <Card>
          <CardContent className="border-l-3 border-l-violet-500 p-4">
            <Typography variant="bodyXs" className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-violet-600">
              Daily Summary
            </Typography>
            <Typography variant="bodySm">
              {d.executiveSummary}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Price Adjustments Table */}
      {adjustments.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <Typography variant="bodySm" className="font-semibold">
                Suggested Price Adjustments
              </Typography>
              <Badge colorRole="brand" size="xs">
                {adjustments.length} suggestions
              </Badge>
            </div>
            <Table>
              <TableHeader>
                <TableRow isHeaderRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Current</TableHead>
                  <TableHead>Suggested</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adjustments.map((adj, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <span className="font-semibold">{adj.productName}</span>
                    </TableCell>
                    <TableCell>${adj.currentPriceUsd.toFixed(0)}</TableCell>
                    <TableCell>${adj.suggestedPriceUsd.toFixed(0)}</TableCell>
                    <TableCell>
                      <span className={adj.changePercent > 0 ? 'font-semibold text-emerald-600' : 'font-semibold text-amber-600'}>
                        {adj.changePercent > 0 ? '+' : ''}{adj.changePercent.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <Typography variant="bodyXs">{adj.reason}</Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Two-Column: Margin Alerts + Competitive Gaps */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Margin Alerts */}
        {marginAlerts.length > 0 && (
          <Card>
            <CardContent className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <Typography variant="bodySm" className="font-semibold">
                  Margin Alerts
                </Typography>
                <Badge colorRole="danger" size="xs">
                  {marginAlerts.length} below target
                </Badge>
              </div>
              <div className="flex flex-col gap-3">
                {marginAlerts.map((alert, i) => (
                  <div key={i} className="rounded-lg border border-border-muted p-3">
                    <Typography variant="bodySm" className="font-semibold">
                      {alert.productName}
                    </Typography>
                    <div className="mt-1 flex items-center gap-3">
                      <span className="text-xs font-semibold text-red-600">
                        {alert.currentMarginPercent.toFixed(0)}% margin
                      </span>
                      <span className="text-xs text-text-muted">
                        target: {alert.targetMarginPercent.toFixed(0)}%
                      </span>
                    </div>
                    <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                      {alert.issue}
                    </Typography>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Competitive Gaps */}
        {gaps.length > 0 && (
          <Card>
            <CardContent className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <Typography variant="bodySm" className="font-semibold">
                  Competitive Gaps
                </Typography>
                <Badge colorRole="neutral" size="xs">
                  <IconScale size={12} className="mr-1" />
                  {gaps.length} gaps
                </Badge>
              </div>
              <div className="flex flex-col gap-3">
                {gaps.map((gap, i) => (
                  <div key={i} className="rounded-lg border border-border-muted p-3">
                    <Typography variant="bodySm" className="font-semibold">
                      {gap.productName}
                    </Typography>
                    <div className="mt-1 flex items-center gap-3 text-xs">
                      <span>Ours: {gap.ourPriceAed.toFixed(0)} AED</span>
                      <span className="text-text-muted">vs</span>
                      <span>{gap.competitorName}: {gap.competitorPriceAed.toFixed(0)} AED</span>
                    </div>
                    <span className={`text-xs font-semibold ${gap.gapPercent > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {gap.gapPercent > 0 ? '+' : ''}{gap.gapPercent.toFixed(1)}%
                      {gap.gapPercent > 0 ? ' more expensive' : ' cheaper'}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Action Items */}
      {actionItems.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <Typography variant="bodySm" className="mb-3 font-semibold">
              Action Items
            </Typography>
            <div className="flex flex-col gap-2">
              {actionItems.map((item, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-border-muted p-3">
                  <Badge
                    colorRole={item.priority === 'high' ? 'danger' : item.priority === 'medium' ? 'warning' : 'neutral'}
                    size="xs"
                    className="mt-0.5 shrink-0"
                  >
                    {item.priority}
                  </Badge>
                  <div>
                    <Typography variant="bodySm" className="font-medium">
                      {item.action}
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted">
                      {item.rationale}
                    </Typography>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PricerBrief;
