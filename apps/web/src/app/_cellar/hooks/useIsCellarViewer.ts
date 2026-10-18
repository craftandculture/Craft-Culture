'use client';

import { useQuery } from '@tanstack/react-query';

import useTRPC from '@/lib/trpc/browser';

/**
 * Whether the person looking at this private cellar may only view it
 *
 * Someone a cellar is shared with as view only is refused every change on the
 * server. Without this, the screens still offered them every button and
 * answered each press with an error. Reads the profile query the cellar pages
 * already load, so it costs no extra request.
 *
 * @example
 *   const isViewer = useIsCellarViewer();
 *
 * @returns True for view-only access, false for the holder or a manager
 */
const useIsCellarViewer = () => {
  const api = useTRPC();
  const { data } = useQuery(api.cellar.member.getProfile.queryOptions());

  return data?.cellarRole === 'viewer';
};

export default useIsCellarViewer;
