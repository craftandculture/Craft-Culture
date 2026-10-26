'use client';

import { useQuery } from '@tanstack/react-query';

import useTRPC from '@/lib/trpc/browser';

/**
 * For a member's menu: whether to show What's New, how many updates are new
 * to them, and which screens to mark "New"
 *
 * Checked every five minutes. A failure hides the link and the marks rather
 * than showing an error in the menu.
 */
const useWhatsNewDot = () => {
  const api = useTRPC();
  const { data } = useQuery({
    ...api.productUpdates.unseenCount.queryOptions(),
    retry: false,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  const newScreens = data?.newScreens ?? [];

  return {
    enabled: data?.enabled ?? false,
    count: data?.count ?? 0,
    hasNew: (data?.count ?? 0) > 0,
    /** Whether a screen gained a feature recently; only while What's New is on */
    isNewScreen: (href: string) => !!data?.enabled && newScreens.includes(href),
  };
};

export default useWhatsNewDot;
