'use client';

import { useQuery } from '@tanstack/react-query';

import useTRPC from '@/lib/trpc/browser';

/**
 * For a member's menu: whether to show What's New, and whether it has a dot
 *
 * Checked every five minutes. A failure hides the link rather than showing
 * an error in the menu.
 */
const useWhatsNewDot = () => {
  const api = useTRPC();
  const { data } = useQuery({
    ...api.productUpdates.unseenCount.queryOptions(),
    retry: false,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  return { enabled: data?.enabled ?? false, hasNew: (data?.count ?? 0) > 0 };
};

export default useWhatsNewDot;
