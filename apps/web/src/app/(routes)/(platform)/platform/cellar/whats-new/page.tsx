'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import CellarPageHeader from '@/app/_cellar/components/CellarPageHeader';
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
    <div className="pb-8">
      <CellarPageHeader
        eyebrow="Updates"
        title="What’s New in your Private Cellar"
        description={
          <>
            Every improvement to your private cellar, in one place.
            {newCount > 0 && (
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                {' '}
                {newCount} new since your last visit.
              </span>
            )}
          </>
        }
      />
      <div className="max-w-3xl">
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
