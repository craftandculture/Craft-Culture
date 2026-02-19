'use client';

import { IconCopy, IconRefresh } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

import Button from '@/app/_ui/components/Button/Button';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

/**
 * Renders the latest Storyteller agent brief with Instagram, WhatsApp, and LinkedIn content
 */
const StorytellerBrief = () => {
  const api = useTRPC();
  const { data, isLoading, refetch } = useQuery({
    ...api.agents.getLatestBrief.queryOptions({ agentId: 'storyteller' }),
    refetchInterval: 60000,
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
          <Typography variant="bodySm" colorRole="muted">
            The Storyteller runs every Monday at 06:05 GST. It generates weekly marketing content
            based on your inventory and recent sales.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const structuredData = brief.data as {
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
  } | null;

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
  };

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

      {/* Instagram Posts */}
      {structuredData?.instagramPosts && structuredData.instagramPosts.length > 0 && (
        <div>
          <Typography variant="headingSm" className="mb-3">
            Instagram
          </Typography>
          <div className="grid gap-3 md:grid-cols-3">
            {structuredData.instagramPosts.map((post, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Typography variant="bodyXs" className="mb-2 font-semibold text-pink-600">
                    {post.wineFeatured}
                  </Typography>
                  <Typography variant="bodyXs" className="mb-2 font-medium">
                    {post.hook}
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted" className="mb-3 line-clamp-4">
                    {post.caption}
                  </Typography>
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
      {structuredData?.whatsappBlasts && structuredData.whatsappBlasts.length > 0 && (
        <div>
          <Typography variant="headingSm" className="mb-3">
            WhatsApp
          </Typography>
          <div className="grid gap-3 md:grid-cols-2">
            {structuredData.whatsappBlasts.map((blast, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Typography variant="bodySm" className="mb-1 font-semibold text-green-600">
                    {blast.subject}
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted" className="mb-2">
                    Target: {blast.targetAudience}
                  </Typography>
                  <div className="rounded-md bg-surface-secondary p-3">
                    <Typography variant="bodyXs">
                      {blast.body}
                    </Typography>
                  </div>
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
      {structuredData?.linkedInPost && (
        <div>
          <Typography variant="headingSm" className="mb-3">
            LinkedIn
          </Typography>
          <Card>
            <CardContent className="p-4">
              <Typography variant="bodySm" className="mb-1 font-semibold text-blue-600">
                {structuredData.linkedInPost.headline}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" className="mb-3">
                Topic: {structuredData.linkedInPost.topic}
              </Typography>
              <Typography variant="bodyXs" className="whitespace-pre-wrap">
                {structuredData.linkedInPost.body}
              </Typography>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() =>
                  copyToClipboard(
                    `${structuredData.linkedInPost!.headline}\n\n${structuredData.linkedInPost!.body}`,
                  )
                }
              >
                <IconCopy size={14} className="mr-1" />
                Copy Post
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Full markdown fallback */}
      <Card>
        <CardContent className="p-6">
          <Typography variant="bodyXs" colorRole="muted" className="mb-2">
            Full Brief
          </Typography>
          <Typography variant="bodySm" className="whitespace-pre-wrap">
            {brief.content}
          </Typography>
        </CardContent>
      </Card>
    </div>
  );
};

export default StorytellerBrief;
