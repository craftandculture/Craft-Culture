'use client';

import { IconRefresh } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

import Button from '@/app/_ui/components/Button/Button';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

/**
 * Simple markdown to HTML conversion for brief content
 */
const markdownToHtml = (md: string) => {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(
      /\|(.+)\|\n\|[-| ]+\|\n((\|.+\|\n?)+)/g,
      (_match, header: string, body: string) => {
        const headers = header
          .split('|')
          .filter(Boolean)
          .map((h: string) => `<th class="px-3 py-2 text-left text-xs font-medium">${h.trim()}</th>`)
          .join('');
        const rows = body
          .trim()
          .split('\n')
          .map((row: string) => {
            const cells = row
              .split('|')
              .filter(Boolean)
              .map((c: string) => `<td class="px-3 py-2 text-sm">${c.trim()}</td>`)
              .join('');
            return `<tr>${cells}</tr>`;
          })
          .join('');
        return `<table class="w-full border-collapse"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
      },
    );
};

/**
 * Renders the latest Scout agent brief with price gaps, blind spots, and action items
 */
const ScoutBrief = () => {
  const api = useTRPC();
  const { data, isLoading, refetch } = useQuery({
    ...api.agents.getLatestBrief.queryOptions({ agentId: 'scout' }),
    refetchInterval: 60000,
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
          <Typography variant="bodySm" colorRole="muted">
            The Scout runs daily at 06:00 GST. Upload competitor wine lists in the Upload tab to
            enable competitive analysis.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const structuredData = brief.data as {
    priceGaps?: Array<{
      productName: string;
      ourPriceAed: number;
      competitorPriceAed: number;
      competitorName: string;
      gapPercent: number;
    }>;
    blindSpots?: Array<{
      productName: string;
      competitorName: string;
      priceAed: number;
    }>;
    actionItems?: Array<{
      priority: string;
      action: string;
      rationale: string;
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

      {/* Markdown content */}
      <Card>
        <CardContent className="prose prose-sm max-w-none p-6 dark:prose-invert">
          <div
            dangerouslySetInnerHTML={{ __html: markdownToHtml(brief.content) }}
          />
        </CardContent>
      </Card>

      {/* Structured KPI cards */}
      {structuredData && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingLg" className="text-orange-600">
                {structuredData.priceGaps?.length ?? 0}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Price Gaps
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingLg" className="text-red-600">
                {structuredData.blindSpots?.length ?? 0}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Blind Spots
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingLg" className="text-blue-600">
                {structuredData.actionItems?.length ?? 0}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Action Items
              </Typography>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ScoutBrief;
