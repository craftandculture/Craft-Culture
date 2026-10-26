'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import WhatsNewHero from '@/app/_productUpdates/components/WhatsNewHero';
import WhatsNewTimeline from '@/app/_productUpdates/components/WhatsNewTimeline';
import useTRPC from '@/lib/trpc/browser';

/**
 * What's New in a member's private cellar
 *
 * Every improvement to the cellar, newest first, with what has appeared since
 * the member's last visit marked New. Opening the page records the visit, so
 * the dot in the menu clears; the badges stay until they next come back.
 */
const CellarWhatsNewPage = () => {
  const api = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const recorded = useRef(false);

  const { data, isLoading } = useQuery({
    ...api.productUpdates.listForMe.queryOptions(),
    // The New badges are worked out from the visit before this one; keep them
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const { mutate: markSeen } = useMutation({
    ...api.productUpdates.markSeen.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: api.productUpdates.unseenCount.queryKey() }),
  });

  useEffect(() => {
    if (!data) return;
    if (!data.enabled) {
      router.replace('/platform/cellar');
      return;
    }
    if (!recorded.current) {
      recorded.current = true;
      markSeen();
    }
  }, [data, markSeen, router]);

  const newCount = data?.seenAt
    ? data.updates.filter((u) => u.publishedAt && new Date(u.publishedAt) > new Date(data.seenAt as Date)).length
    : 0;

  return (
    <div className="mx-auto w-full max-w-3xl pb-8">
      <WhatsNewHero
        newCount={newCount}
        counts={{
          feature: data?.updates.filter((u) => u.type === 'feature').length ?? 0,
          improvement: data?.updates.filter((u) => u.type === 'improvement').length ?? 0,
          fix: data?.updates.filter((u) => u.type === 'fix').length ?? 0,
        }}
      />
      <div>
        {isLoading || !data?.enabled ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-fill-muted h-28 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : (
          <WhatsNewTimeline updates={data.updates} seenAt={data.seenAt} />
        )}
      </div>
    </div>
  );
};

export default CellarWhatsNewPage;
