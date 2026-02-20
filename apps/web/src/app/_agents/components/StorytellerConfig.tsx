'use client';

import { IconCheck, IconDeviceFloppy } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

const CONFIG_KEYS = {
  brandVoice: 'brand_voice',
  contentIdeas: 'content_ideas',
  calendarContext: 'calendar_context',
} as const;

/**
 * Configuration panel for the Storyteller agent — brand voice, content ideas, calendar context
 */
const StorytellerConfig = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const [brandVoice, setBrandVoice] = useState('');
  const [contentIdeas, setContentIdeas] = useState('');
  const [calendarContext, setCalendarContext] = useState('');
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const { data: configs, isLoading } = useQuery({
    ...api.agents.getAgentConfig.queryOptions({ agentId: 'storyteller' }),
  });

  useEffect(() => {
    if (configs) {
      for (const cfg of configs) {
        if (cfg.configKey === CONFIG_KEYS.brandVoice) setBrandVoice(cfg.configValue);
        if (cfg.configKey === CONFIG_KEYS.contentIdeas) setContentIdeas(cfg.configValue);
        if (cfg.configKey === CONFIG_KEYS.calendarContext) setCalendarContext(cfg.configValue);
      }
    }
  }, [configs]);

  const { mutate: upsertConfig } = useMutation({
    ...api.agents.upsertAgentConfig.mutationOptions(),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: api.agents.getAgentConfig.queryKey({ agentId: 'storyteller' }),
      });
      setSavedKey(variables.configKey);
      setTimeout(() => setSavedKey(null), 2000);
    },
  });

  const handleSave = (configKey: string, configValue: string) => {
    upsertConfig({
      agentId: 'storyteller',
      configKey,
      configValue,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Typography variant="bodySm" colorRole="muted">
            Loading Storyteller config...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <Typography variant="headingSm">Storyteller Configuration</Typography>
        <Typography variant="bodySm" colorRole="muted">
          Customize brand voice, feed content ideas, and add calendar context to guide the
          Storyteller&apos;s weekly content generation.
        </Typography>
      </div>

      {/* Brand Voice */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <div>
            <Typography variant="bodySm" className="font-semibold">
              Brand Voice
            </Typography>
            <Typography variant="bodyXs" colorRole="muted">
              Describe the tone, style, and personality for Craft &amp; Culture&apos;s content.
              Reference your Instagram, LinkedIn, or WhatsApp tone here.
            </Typography>
          </div>
          <textarea
            value={brandVoice}
            onChange={(e) => setBrandVoice(e.target.value)}
            placeholder="e.g. Sophisticated but approachable. We don't talk down to our audience — we invite them into the world of wine. Use warm, conversational language. Reference Dubai lifestyle, dining, and entertaining..."
            rows={5}
            className="w-full rounded-md border border-border-muted bg-background-primary px-3 py-2 text-sm focus:border-border-brand focus:outline-none"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSave(CONFIG_KEYS.brandVoice, brandVoice)}
            disabled={upsertMutation.isPending}
          >
            {savedKey === CONFIG_KEYS.brandVoice ? (
              <>
                <IconCheck size={14} className="mr-1 text-emerald-600" />
                Saved
              </>
            ) : (
              <>
                <IconDeviceFloppy size={14} className="mr-1" />
                Save Brand Voice
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Content Ideas */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <div>
            <Typography variant="bodySm" className="font-semibold">
              Content Ideas &amp; Topics
            </Typography>
            <Typography variant="bodyXs" colorRole="muted">
              List topics, themes, or specific content ideas you want the Storyteller to focus on.
              One per line works well.
            </Typography>
          </div>
          <textarea
            value={contentIdeas}
            onChange={(e) => setContentIdeas(e.target.value)}
            placeholder="e.g.&#10;- Feature our new Burgundy arrivals&#10;- Behind the scenes at the warehouse&#10;- Wine pairing tips for Dubai summer&#10;- Spotlight on our Champagne producers&#10;- Client testimonials and dinner party stories"
            rows={6}
            className="w-full rounded-md border border-border-muted bg-background-primary px-3 py-2 text-sm focus:border-border-brand focus:outline-none"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSave(CONFIG_KEYS.contentIdeas, contentIdeas)}
            disabled={upsertMutation.isPending}
          >
            {savedKey === CONFIG_KEYS.contentIdeas ? (
              <>
                <IconCheck size={14} className="mr-1 text-emerald-600" />
                Saved
              </>
            ) : (
              <>
                <IconDeviceFloppy size={14} className="mr-1" />
                Save Content Ideas
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Calendar Context */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <div>
            <Typography variant="bodySm" className="font-semibold">
              Calendar &amp; Context
            </Typography>
            <Typography variant="bodyXs" colorRole="muted">
              Upcoming events, seasonal themes, promotions, or anything the Storyteller should
              factor into this week&apos;s content.
            </Typography>
          </div>
          <textarea
            value={calendarContext}
            onChange={(e) => setCalendarContext(e.target.value)}
            placeholder="e.g.&#10;- Art Dubai starts March 5 — focus on art + wine content&#10;- Ramadan begins March 10 — shift to gifting content&#10;- We have a tasting event on March 15&#10;- Dubai Food Festival runs Feb 25 - Mar 12"
            rows={5}
            className="w-full rounded-md border border-border-muted bg-background-primary px-3 py-2 text-sm focus:border-border-brand focus:outline-none"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSave(CONFIG_KEYS.calendarContext, calendarContext)}
            disabled={upsertMutation.isPending}
          >
            {savedKey === CONFIG_KEYS.calendarContext ? (
              <>
                <IconCheck size={14} className="mr-1 text-emerald-600" />
                Saved
              </>
            ) : (
              <>
                <IconDeviceFloppy size={14} className="mr-1" />
                Save Calendar Context
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default StorytellerConfig;
