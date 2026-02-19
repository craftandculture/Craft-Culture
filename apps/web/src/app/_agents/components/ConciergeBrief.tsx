'use client';

import { IconRefresh } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

import Button from '@/app/_ui/components/Button/Button';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

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

  const structuredData = brief.data as {
    hotLeads?: Array<{
      clientName: string;
      reason: string;
      suggestedAction: string;
      suggestedMessage: string;
    }>;
    dormantClients?: Array<{
      clientName: string;
      daysSinceOrder: number;
      reEngagementIdea: string;
    }>;
    upsellOpportunities?: Array<{
      clientName: string;
      suggestion: string;
    }>;
  } | null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Typography variant="headingSm">
            {brief.title}
          </Typography>
          <Typography variant="bodyXs" colorRole="muted">
            {brief.createdAt.toLocaleString()}
          </Typography>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <IconRefresh size={16} />
        </Button>
      </div>

      {/* KPI cards */}
      {structuredData && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingLg" className="text-green-600">
                {structuredData.hotLeads?.length ?? 0}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Hot Leads
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingLg" className="text-amber-600">
                {structuredData.dormantClients?.length ?? 0}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Dormant
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingLg" className="text-purple-600">
                {structuredData.upsellOpportunities?.length ?? 0}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Upsells
              </Typography>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Hot leads detail */}
      {structuredData?.hotLeads && structuredData.hotLeads.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <Typography variant="headingSm" className="mb-3">
              Hot Leads
            </Typography>
            <div className="space-y-3">
              {structuredData.hotLeads.map((lead, i) => (
                <div key={i} className="rounded-lg border border-border-muted p-3">
                  <div className="flex items-start justify-between">
                    <Typography variant="bodySm" className="font-semibold">
                      {lead.clientName}
                    </Typography>
                  </div>
                  <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                    {lead.reason}
                  </Typography>
                  <div className="mt-2 rounded-md bg-surface-secondary p-2">
                    <Typography variant="bodyXs" className="italic">
                      {lead.suggestedMessage}
                    </Typography>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full markdown brief */}
      <Card>
        <CardContent className="p-6">
          <Typography variant="bodySm" className="whitespace-pre-wrap">
            {brief.content}
          </Typography>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConciergeBrief;
