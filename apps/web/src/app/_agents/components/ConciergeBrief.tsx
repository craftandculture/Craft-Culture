'use client';

import {
  IconCopy,
  IconFlame,
  IconRefresh,
  IconTrendingUp,
  IconUserStar,
  IconZzz,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

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

interface ConciergeData {
  executiveSummary?: string;
  hotLeads?: Array<{
    clientName: string;
    reason: string;
    suggestedAction: string;
    suggestedMessage: string;
  }>;
  dormantClients?: Array<{
    clientName: string;
    lastOrderDate?: string;
    daysSinceOrder: number;
    reEngagementIdea: string;
  }>;
  upsellOpportunities?: Array<{
    clientName: string;
    previousPurchases: string;
    suggestion: string;
  }>;
}

const copyToClipboard = (text: string) => {
  void navigator.clipboard.writeText(text);
};

const dormancyColor = (days: number) => {
  if (days > 60) return 'text-red-600';
  if (days > 30) return 'text-amber-600';
  return 'text-text-muted';
};

/**
 * Renders the latest Concierge agent brief with hot leads, dormant clients, and upsell opportunities
 */
const ConciergeBrief = () => {
  const api = useTRPC();
  const { data, isLoading, refetch } = useQuery({
    ...api.agents.getLatestBrief.queryOptions({ agentId: 'concierge' }),
    refetchInterval: 60000,
  });

  const brief = data?.[0];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Typography variant="bodySm" colorRole="muted">
            Loading Concierge brief...
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
            No Concierge Brief Yet
          </Typography>
          <Typography variant="bodySm" colorRole="muted">
            The Concierge runs daily at 06:15 GST. It analyzes client contacts and order history to
            generate personalized outreach suggestions.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const d = brief.data as ConciergeData | null;
  const hotLeads = d?.hotLeads ?? [];
  const dormantClients = d?.dormantClients ?? [];
  const upsellOpps = d?.upsellOpportunities ?? [];

  return (
    <div className="space-y-5">
      {/* Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Typography variant="headingSm">The Concierge</Typography>
          <Typography variant="bodyXs" colorRole="muted">
            Client relationship intelligence &amp; outreach
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
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="flex items-start justify-between p-4">
            <div>
              <Typography variant="bodyXs" colorRole="muted" className="text-[11px] font-medium uppercase tracking-wider">
                Hot Leads
              </Typography>
              <Typography variant="headingLg" className="mt-1 text-emerald-600">
                {hotLeads.length}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" className="mt-0.5">
                Ready to contact today
              </Typography>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <IconFlame size={18} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start justify-between p-4">
            <div>
              <Typography variant="bodyXs" colorRole="muted" className="text-[11px] font-medium uppercase tracking-wider">
                Dormant Clients
              </Typography>
              <Typography variant="headingLg" className="mt-1 text-amber-600">
                {dormantClients.length}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" className="mt-0.5">
                Need re-engagement
              </Typography>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <IconZzz size={18} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start justify-between p-4">
            <div>
              <Typography variant="bodyXs" colorRole="muted" className="text-[11px] font-medium uppercase tracking-wider">
                Upsell Opportunities
              </Typography>
              <Typography variant="headingLg" className="mt-1 text-violet-600">
                {upsellOpps.length}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" className="mt-0.5">
                Cross-sell potential
              </Typography>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
              <IconTrendingUp size={18} />
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

      {/* Hot Leads */}
      {hotLeads.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <Typography variant="bodySm" className="font-semibold">
                Hot Leads
              </Typography>
              <Badge colorRole="success" size="xs">
                {hotLeads.length} to contact
              </Badge>
            </div>
            <div className="flex flex-col gap-3">
              {hotLeads.map((lead, i) => (
                <div key={i} className="rounded-lg border border-border-muted p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                        <IconUserStar size={14} />
                      </div>
                      <Typography variant="bodySm" className="font-semibold">
                        {lead.clientName}
                      </Typography>
                    </div>
                    <Badge colorRole="success" size="xs">hot</Badge>
                  </div>
                  <Typography variant="bodyXs" colorRole="muted" className="mt-2">
                    {lead.reason}
                  </Typography>
                  <Typography variant="bodyXs" className="mt-1.5 font-medium text-text-brand">
                    Action: {lead.suggestedAction}
                  </Typography>
                  <div className="mt-2 rounded-md bg-surface-secondary p-2.5">
                    <Typography variant="bodyXs" className="italic">
                      &ldquo;{lead.suggestedMessage}&rdquo;
                    </Typography>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => copyToClipboard(lead.suggestedMessage)}
                  >
                    <IconCopy size={14} className="mr-1" />
                    Copy Message
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Two-Column: Dormant Clients + Upsell Opportunities */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[7fr_5fr]">
        {/* Dormant Clients Table */}
        {dormantClients.length > 0 && (
          <Card>
            <CardContent className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <Typography variant="bodySm" className="font-semibold">
                  Dormant Clients
                </Typography>
                <Badge colorRole="warning" size="xs">
                  {dormantClients.length} inactive
                </Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow isHeaderRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Days Ago</TableHead>
                    <TableHead>Re-engagement Idea</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dormantClients.map((client, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <span className="font-semibold">{client.clientName}</span>
                        {client.lastOrderDate && (
                          <Typography variant="bodyXs" colorRole="muted">
                            Last: {client.lastOrderDate}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`font-semibold ${dormancyColor(client.daysSinceOrder)}`}>
                          {client.daysSinceOrder}d
                        </span>
                      </TableCell>
                      <TableCell>
                        <Typography variant="bodyXs">
                          {client.reEngagementIdea}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Upsell Opportunities */}
        {upsellOpps.length > 0 && (
          <div className="flex flex-col gap-4">
            <Typography variant="bodySm" className="font-semibold">
              Upsell Opportunities
            </Typography>
            {upsellOpps.map((opp, i) => (
              <Card key={i}>
                <CardContent className="border-l-3 border-l-emerald-500 p-4">
                  <Typography variant="bodySm" className="font-semibold">
                    {opp.clientName}
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                    Buys: {opp.previousPurchases}
                  </Typography>
                  <Typography variant="bodyXs" className="mt-1.5 text-emerald-700">
                    Suggest: {opp.suggestion}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConciergeBrief;
