'use client';

import {
  IconAlertCircle,
  IconBinoculars,
  IconBrain,
  IconCurrencyDollar,
  IconPackage,
  IconPencil,
  IconRefresh,
  IconShoppingCart,
  IconSparkles,
  IconTrendingUp,
  IconTruck,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

interface AdvisorData {
  executiveSummary?: string;
  kpiSnapshot?: {
    revenueThisMonthUsd: number;
    revenueTrend: string;
    openOrders: number;
    overdueInvoicesUsd: number;
    stockCasesTotal: number;
    dispatchPending: number;
  };
  risks?: Array<{
    severity: string;
    title: string;
    description: string;
    suggestedAction: string;
  }>;
  opportunities?: Array<{
    title: string;
    description: string;
    estimatedImpactUsd: number;
    suggestedAction: string;
  }>;
  agentSynthesis?: Array<{
    agentId: string;
    keyTakeaway: string;
  }>;
  weeklyFocus?: Array<{
    priority: number;
    focus: string;
    rationale: string;
  }>;
}

const agentIcons: Record<string, typeof IconBrain> = {
  scout: IconBinoculars,
  concierge: IconSparkles,
  storyteller: IconPencil,
  buyer: IconShoppingCart,
  pricer: IconCurrencyDollar,
};

const agentLabels: Record<string, string> = {
  scout: 'Market Scout',
  concierge: 'PCO Concierge',
  storyteller: 'The Storyteller',
  buyer: 'The Buyer',
  pricer: 'The Pricer',
};

/**
 * Renders the latest Advisor agent brief with KPI snapshot, risks, opportunities, and agent synthesis
 */
const AdvisorBrief = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    ...api.agents.getLatestBrief.queryOptions({ agentId: 'advisor' }),
    refetchInterval: 60000,
  });

  const triggerMutation = useMutation({
    ...api.agents.triggerAgent.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: api.agents.getLatestBrief.queryKey({ agentId: 'advisor' }),
      });
    },
  });

  const brief = data?.[0];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Typography variant="bodySm" colorRole="muted">
            Loading Advisor brief...
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
            No Advisor Brief Yet
          </Typography>
          <Typography variant="bodySm" colorRole="muted" className="mb-4">
            The Advisor runs weekly on Monday at 07:00 GST. It synthesizes all agent insights,
            financial data, and operational metrics into a strategic brief.
          </Typography>
          <Button
            variant="primary"
            size="sm"
            onClick={() => triggerMutation.mutate({ agentId: 'advisor' })}
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

  const d = brief.data as AdvisorData | null;
  const kpi = d?.kpiSnapshot;
  const risks = d?.risks ?? [];
  const opportunities = d?.opportunities ?? [];
  const synthesis = d?.agentSynthesis ?? [];
  const focus = d?.weeklyFocus ?? [];

  return (
    <div className="space-y-5">
      {/* Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Typography variant="headingSm">The Advisor</Typography>
          <Typography variant="bodyXs" colorRole="muted">
            Strategic intelligence &amp; weekly priorities
          </Typography>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-600" />
            Last run: {brief.createdAt.toLocaleString()}
          </div>
          <Button variant="ghost" size="sm" onClick={() => triggerMutation.mutate({ agentId: 'advisor' })} disabled={triggerMutation.isPending}>
            <IconRefresh size={16} className={triggerMutation.isPending ? 'mr-1 animate-spin' : 'mr-1'} />
            {triggerMutation.isPending ? 'Running...' : 'Run Now'}
          </Button>
        </div>
      </div>

      {/* KPI Snapshot */}
      {kpi && (
        <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
          <Card>
            <CardContent className="p-3 text-center">
              <Typography variant="bodyXs" colorRole="muted" className="text-[10px] font-medium uppercase">
                Revenue MTD
              </Typography>
              <Typography variant="headingSm" className="mt-1 text-emerald-600">
                ${(kpi.revenueThisMonthUsd / 1000).toFixed(0)}k
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Typography variant="bodyXs" colorRole="muted" className="text-[10px] font-medium uppercase">
                Trend
              </Typography>
              <Typography variant="headingSm" className="mt-1">
                {kpi.revenueTrend}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Typography variant="bodyXs" colorRole="muted" className="text-[10px] font-medium uppercase">
                Open Orders
              </Typography>
              <Typography variant="headingSm" className="mt-1 text-blue-600">
                {kpi.openOrders}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Typography variant="bodyXs" colorRole="muted" className="text-[10px] font-medium uppercase">
                Overdue
              </Typography>
              <Typography variant="headingSm" className={`mt-1 ${kpi.overdueInvoicesUsd > 0 ? 'text-red-600' : 'text-text-muted'}`}>
                ${(kpi.overdueInvoicesUsd / 1000).toFixed(0)}k
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Typography variant="bodyXs" colorRole="muted" className="text-[10px] font-medium uppercase">
                Stock
              </Typography>
              <Typography variant="headingSm" className="mt-1">
                <IconPackage size={14} className="mr-1 inline" />
                {kpi.stockCasesTotal}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Typography variant="bodyXs" colorRole="muted" className="text-[10px] font-medium uppercase">
                Dispatch
              </Typography>
              <Typography variant="headingSm" className="mt-1">
                <IconTruck size={14} className="mr-1 inline" />
                {kpi.dispatchPending}
              </Typography>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Executive Summary */}
      {d?.executiveSummary && (
        <Card>
          <CardContent className="border-l-3 border-l-indigo-500 p-4">
            <Typography variant="bodyXs" className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-600">
              Strategic Summary
            </Typography>
            <Typography variant="bodySm">
              {d.executiveSummary}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Risks + Opportunities */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Risks */}
        {risks.length > 0 && (
          <Card>
            <CardContent className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <Typography variant="bodySm" className="font-semibold">
                  Risks
                </Typography>
                <Badge colorRole="danger" size="xs">
                  <IconAlertCircle size={12} className="mr-1" />
                  {risks.length} flagged
                </Badge>
              </div>
              <div className="flex flex-col gap-3">
                {risks.map((risk, i) => (
                  <div key={i} className="rounded-lg border border-border-muted p-3">
                    <div className="flex items-start gap-2">
                      <Badge
                        colorRole={risk.severity === 'high' ? 'danger' : risk.severity === 'medium' ? 'warning' : 'neutral'}
                        size="xs"
                        className="mt-0.5 shrink-0"
                      >
                        {risk.severity}
                      </Badge>
                      <Typography variant="bodySm" className="font-semibold">
                        {risk.title}
                      </Typography>
                    </div>
                    <Typography variant="bodyXs" colorRole="muted" className="mt-1.5">
                      {risk.description}
                    </Typography>
                    <Typography variant="bodyXs" className="mt-1.5 font-medium text-text-brand">
                      Action: {risk.suggestedAction}
                    </Typography>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Opportunities */}
        {opportunities.length > 0 && (
          <Card>
            <CardContent className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <Typography variant="bodySm" className="font-semibold">
                  Opportunities
                </Typography>
                <Badge colorRole="success" size="xs">
                  <IconTrendingUp size={12} className="mr-1" />
                  {opportunities.length} identified
                </Badge>
              </div>
              <div className="flex flex-col gap-3">
                {opportunities.map((opp, i) => (
                  <div key={i} className="rounded-lg border border-border-muted p-3">
                    <Typography variant="bodySm" className="font-semibold">
                      {opp.title}
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                      {opp.description}
                    </Typography>
                    <div className="mt-1.5 flex items-center justify-between">
                      <Typography variant="bodyXs" className="font-medium text-emerald-700">
                        Impact: ~${opp.estimatedImpactUsd.toLocaleString()}
                      </Typography>
                    </div>
                    <Typography variant="bodyXs" className="mt-1 font-medium text-text-brand">
                      Action: {opp.suggestedAction}
                    </Typography>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Agent Synthesis */}
      {synthesis.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <Typography variant="bodySm" className="mb-3 font-semibold">
              Agent Synthesis
            </Typography>
            <div className="flex flex-col gap-2">
              {synthesis.map((s, i) => {
                const AgentIcon = agentIcons[s.agentId] ?? IconBrain;
                return (
                  <div key={i} className="flex items-start gap-3 rounded-lg border border-border-muted p-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-secondary">
                      <AgentIcon size={14} />
                    </div>
                    <div>
                      <Typography variant="bodyXs" className="font-semibold">
                        {agentLabels[s.agentId] ?? s.agentId}
                      </Typography>
                      <Typography variant="bodyXs" colorRole="muted">
                        {s.keyTakeaway}
                      </Typography>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weekly Focus */}
      {focus.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <Typography variant="bodySm" className="mb-3 font-semibold">
              Weekly Focus
            </Typography>
            <div className="flex flex-col gap-2">
              {focus.map((item, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-border-muted p-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-600">
                    {item.priority}
                  </div>
                  <div>
                    <Typography variant="bodySm" className="font-medium">
                      {item.focus}
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

export default AdvisorBrief;
