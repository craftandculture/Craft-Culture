'use client';

import {
  IconAlertTriangle,
  IconRefresh,
  IconShoppingCart,
  IconSparkles,
  IconTrendingDown,
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

interface BuyerData {
  executiveSummary?: string;
  reorderAlerts?: Array<{
    lwin18: string;
    productName: string;
    currentStock: number;
    weeklyVelocity: number;
    weeksOfStock: number;
    suggestedQuantity: number;
    suggestedSupplier: string;
    estimatedCostUsd: number;
  }>;
  newOpportunities?: Array<{
    productName: string;
    supplier: string;
    costPriceUsd: number;
    rationale: string;
  }>;
  overStocked?: Array<{
    lwin18: string;
    productName: string;
    currentStock: number;
    weeklyVelocity: number;
    weeksOfStock: number;
    recommendation: string;
  }>;
  actionItems?: Array<{
    priority: string;
    action: string;
    rationale: string;
  }>;
}

const stockColor = (weeks: number) => {
  if (weeks < 2) return 'text-red-600';
  if (weeks < 4) return 'text-amber-600';
  return 'text-text-muted';
};

/**
 * Renders the latest Buyer agent brief with reorder alerts, new opportunities, and overstock warnings
 */
const BuyerBrief = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    ...api.agents.getLatestBrief.queryOptions({ agentId: 'buyer' }),
    refetchInterval: 60000,
  });

  const triggerMutation = useMutation({
    ...api.agents.triggerAgent.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: api.agents.getLatestBrief.queryKey({ agentId: 'buyer' }),
      });
    },
  });

  const brief = data?.[0];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Typography variant="bodySm" colorRole="muted">
            Loading Purchasing brief...
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
            No Purchasing Brief Yet
          </Typography>
          <Typography variant="bodySm" colorRole="muted" className="mb-4">
            Purchasing runs daily at 06:30 GST. It analyzes stock levels, velocity, and supplier
            availability to generate purchasing recommendations.
          </Typography>
          <Button
            variant="primary"
            size="sm"
            onClick={() => triggerMutation.mutate({ agentId: 'buyer' })}
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

  const d = brief.data as BuyerData | null;
  const reorderAlerts = d?.reorderAlerts ?? [];
  const newOpps = d?.newOpportunities ?? [];
  const overStocked = d?.overStocked ?? [];
  const actionItems = d?.actionItems ?? [];

  return (
    <div className="space-y-5">
      {/* Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Typography variant="headingSm">Purchasing</Typography>
          <Typography variant="bodyXs" colorRole="muted">
            Purchasing intelligence &amp; reorder recommendations
          </Typography>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-600" />
            Last run: {brief.createdAt.toLocaleString()}
          </div>
          <Button variant="ghost" size="sm" onClick={() => triggerMutation.mutate({ agentId: 'buyer' })} disabled={triggerMutation.isPending}>
            <IconRefresh size={16} className={triggerMutation.isPending ? 'mr-1 animate-spin' : 'mr-1'} />
            {triggerMutation.isPending ? 'Running...' : 'Run Now'}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="flex items-start justify-between p-4">
            <div>
              <Typography variant="bodyXs" colorRole="muted" className="text-[11px] font-medium uppercase tracking-wider">
                Reorder Alerts
              </Typography>
              <Typography variant="headingLg" className="mt-1 text-amber-600">
                {reorderAlerts.length}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" className="mt-0.5">
                Low stock items
              </Typography>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <IconAlertTriangle size={18} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start justify-between p-4">
            <div>
              <Typography variant="bodyXs" colorRole="muted" className="text-[11px] font-medium uppercase tracking-wider">
                New Opportunities
              </Typography>
              <Typography variant="headingLg" className="mt-1 text-emerald-600">
                {newOpps.length}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" className="mt-0.5">
                From suppliers
              </Typography>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <IconSparkles size={18} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start justify-between p-4">
            <div>
              <Typography variant="bodyXs" colorRole="muted" className="text-[11px] font-medium uppercase tracking-wider">
                Overstock Warnings
              </Typography>
              <Typography variant="headingLg" className="mt-1 text-red-600">
                {overStocked.length}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" className="mt-0.5">
                Slow-moving SKUs
              </Typography>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600">
              <IconTrendingDown size={18} />
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
                Prioritized tasks
              </Typography>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <IconShoppingCart size={18} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Executive Summary */}
      {d?.executiveSummary && (
        <Card>
          <CardContent className="border-l-3 border-l-blue-500 p-4">
            <Typography variant="bodyXs" className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-blue-600">
              Daily Summary
            </Typography>
            <Typography variant="bodySm">
              {d.executiveSummary}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Reorder Alerts Table */}
      {reorderAlerts.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <Typography variant="bodySm" className="font-semibold">
                Reorder Alerts
              </Typography>
              <Badge colorRole="warning" size="xs">
                {reorderAlerts.length} items need ordering
              </Badge>
            </div>
            <Table>
              <TableHeader>
                <TableRow isHeaderRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Current Stock</TableHead>
                  <TableHead>Velocity</TableHead>
                  <TableHead>Weeks Left</TableHead>
                  <TableHead>Suggested Qty</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Est. Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reorderAlerts.map((alert, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <span className="font-semibold">{alert.productName}</span>
                    </TableCell>
                    <TableCell>{alert.currentStock} cs</TableCell>
                    <TableCell>{alert.weeklyVelocity.toFixed(1)} cs/wk</TableCell>
                    <TableCell>
                      <span className={`font-semibold ${stockColor(alert.weeksOfStock)}`}>
                        {alert.weeksOfStock.toFixed(1)}w
                      </span>
                    </TableCell>
                    <TableCell>{alert.suggestedQuantity} cs</TableCell>
                    <TableCell>
                      <Typography variant="bodyXs">{alert.suggestedSupplier}</Typography>
                    </TableCell>
                    <TableCell>${alert.estimatedCostUsd.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Two-Column: Opportunities + Overstock */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* New Opportunities */}
        {newOpps.length > 0 && (
          <Card>
            <CardContent className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <Typography variant="bodySm" className="font-semibold">
                  New Opportunities
                </Typography>
                <Badge colorRole="success" size="xs">
                  {newOpps.length} suppliers
                </Badge>
              </div>
              <div className="flex flex-col gap-3">
                {newOpps.map((opp, i) => (
                  <div key={i} className="rounded-lg border border-border-muted p-3">
                    <Typography variant="bodySm" className="font-semibold">
                      {opp.productName}
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                      Supplier: {opp.supplier} — ${opp.costPriceUsd.toFixed(0)} USD
                    </Typography>
                    <Typography variant="bodyXs" className="mt-1.5 text-emerald-700">
                      {opp.rationale}
                    </Typography>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Overstock Warnings */}
        {overStocked.length > 0 && (
          <Card>
            <CardContent className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <Typography variant="bodySm" className="font-semibold">
                  Overstock Warnings
                </Typography>
                <Badge colorRole="danger" size="xs">
                  {overStocked.length} slow movers
                </Badge>
              </div>
              <div className="flex flex-col gap-3">
                {overStocked.map((item, i) => (
                  <div key={i} className="rounded-lg border border-border-muted p-3">
                    <div className="flex items-start justify-between">
                      <Typography variant="bodySm" className="font-semibold">
                        {item.productName}
                      </Typography>
                      <span className="text-xs font-semibold text-red-600">
                        {item.weeksOfStock.toFixed(0)}w stock
                      </span>
                    </div>
                    <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                      {item.currentStock} cases | {item.weeklyVelocity.toFixed(1)} cs/wk
                    </Typography>
                    <Typography variant="bodyXs" className="mt-1.5">
                      {item.recommendation}
                    </Typography>
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

export default BuyerBrief;
