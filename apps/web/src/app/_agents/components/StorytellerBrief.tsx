'use client';

import {
  IconBrandInstagram,
  IconBrandLinkedin,
  IconBrandWhatsapp,
  IconCopy,
  IconRefresh,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

interface StorytellerData {
  executiveSummary?: string;
  instagramPosts?: Array<{
    caption: string;
    imagePrompt: string;
    wineFeatured: string;
    hook: string;
  }>;
  whatsappBlasts?: Array<{
    subject: string;
    body: string;
    targetAudience: string;
    callToAction: string;
  }>;
  linkedInPost?: {
    headline: string;
    body: string;
    topic: string;
  };
}

const copyToClipboard = (text: string) => {
  void navigator.clipboard.writeText(text);
};

/**
 * Renders the latest Storyteller agent brief with Instagram, WhatsApp, and LinkedIn content
 */
const StorytellerBrief = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    ...api.agents.getLatestBrief.queryOptions({ agentId: 'storyteller' }),
    refetchInterval: 60000,
  });

  const triggerMutation = useMutation({
    ...api.agents.triggerAgent.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: api.agents.getLatestBrief.queryKey({ agentId: 'storyteller' }),
      });
    },
  });

  const brief = data?.[0];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Typography variant="bodySm" colorRole="muted">
            Loading Storyteller brief...
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
            No Storyteller Brief Yet
          </Typography>
          <Typography variant="bodySm" colorRole="muted" className="mb-4">
            The Storyteller runs every Monday at 06:05 GST. It generates weekly marketing content
            based on your inventory and recent sales.
          </Typography>
          <Button
            variant="primary"
            size="sm"
            onClick={() => triggerMutation.mutate({ agentId: 'storyteller' })}
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

  const d = brief.data as StorytellerData | null;
  const instagramPosts = d?.instagramPosts ?? [];
  const whatsappBlasts = d?.whatsappBlasts ?? [];
  const linkedInPost = d?.linkedInPost;

  return (
    <div className="space-y-5">
      {/* Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Typography variant="headingSm">The Storyteller</Typography>
          <Typography variant="bodyXs" colorRole="muted">
            Weekly marketing content generation
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
                Instagram
              </Typography>
              <Typography variant="headingLg" className="mt-1 text-pink-600">
                {instagramPosts.length}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" className="mt-0.5">
                Posts ready
              </Typography>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-pink-100 text-pink-600">
              <IconBrandInstagram size={18} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start justify-between p-4">
            <div>
              <Typography variant="bodyXs" colorRole="muted" className="text-[11px] font-medium uppercase tracking-wider">
                WhatsApp
              </Typography>
              <Typography variant="headingLg" className="mt-1 text-green-600">
                {whatsappBlasts.length}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" className="mt-0.5">
                Broadcasts ready
              </Typography>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-600">
              <IconBrandWhatsapp size={18} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start justify-between p-4">
            <div>
              <Typography variant="bodyXs" colorRole="muted" className="text-[11px] font-medium uppercase tracking-wider">
                LinkedIn
              </Typography>
              <Typography variant="headingLg" className="mt-1 text-blue-600">
                {linkedInPost ? 1 : 0}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" className="mt-0.5">
                Post ready
              </Typography>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <IconBrandLinkedin size={18} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content Theme */}
      {d?.executiveSummary && (
        <Card>
          <CardContent className="border-l-3 border-l-violet-500 p-4">
            <Typography variant="bodyXs" className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-violet-600">
              Weekly Theme
            </Typography>
            <Typography variant="bodySm">
              {d.executiveSummary}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Instagram Posts */}
      {instagramPosts.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <IconBrandInstagram size={18} className="text-pink-600" />
            <Typography variant="bodySm" className="font-semibold">
              Instagram
            </Typography>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {instagramPosts.map((post, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Badge colorRole="brand" size="xs" className="mb-2">
                    {post.wineFeatured}
                  </Badge>
                  <Typography variant="bodySm" className="mb-2 font-semibold">
                    {post.hook}
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted" className="mb-2 line-clamp-4">
                    {post.caption}
                  </Typography>
                  <div className="mb-3 rounded-md bg-surface-secondary p-2">
                    <Typography variant="bodyXs" colorRole="muted" className="text-[10px] font-medium uppercase tracking-wider">
                      Image Brief
                    </Typography>
                    <Typography variant="bodyXs" className="mt-0.5">
                      {post.imagePrompt}
                    </Typography>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => copyToClipboard(post.caption)}
                  >
                    <IconCopy size={14} className="mr-1" />
                    Copy Caption
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* WhatsApp Blasts */}
      {whatsappBlasts.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <IconBrandWhatsapp size={18} className="text-green-600" />
            <Typography variant="bodySm" className="font-semibold">
              WhatsApp Broadcasts
            </Typography>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {whatsappBlasts.map((blast, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Typography variant="bodySm" className="mb-1 font-semibold">
                    {blast.subject}
                  </Typography>
                  <div className="mb-2 flex items-center gap-2">
                    <Badge colorRole="info" size="xs">
                      {blast.targetAudience}
                    </Badge>
                  </div>
                  <div className="rounded-md bg-surface-secondary p-3">
                    <Typography variant="bodyXs">
                      {blast.body}
                    </Typography>
                  </div>
                  <Typography variant="bodyXs" className="mt-2 font-medium text-text-brand">
                    CTA: {blast.callToAction}
                  </Typography>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => copyToClipboard(blast.body)}
                  >
                    <IconCopy size={14} className="mr-1" />
                    Copy Message
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* LinkedIn Post */}
      {linkedInPost && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <IconBrandLinkedin size={18} className="text-blue-600" />
            <Typography variant="bodySm" className="font-semibold">
              LinkedIn
            </Typography>
          </div>
          <Card>
            <CardContent className="p-4">
              <Typography variant="bodySm" className="mb-1 font-semibold">
                {linkedInPost.headline}
              </Typography>
              <Badge colorRole="info" size="xs" className="mb-3">
                {linkedInPost.topic}
              </Badge>
              <Typography variant="bodyXs" className="whitespace-pre-wrap">
                {linkedInPost.body}
              </Typography>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() =>
                  copyToClipboard(`${linkedInPost.headline}\n\n${linkedInPost.body}`)
                }
              >
                <IconCopy size={14} className="mr-1" />
                Copy Post
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default StorytellerBrief;
