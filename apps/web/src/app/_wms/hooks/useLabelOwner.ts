'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import useTRPC from '@/lib/trpc/browser';

import labelOwnerText from '../utils/labelOwnerText';

/**
 * Resolve the owner text for a label printed in the browser
 *
 * Returns an async function, called at print time, that loads (or reuses) the
 * list of hidden owners and applies the label rule. If the list cannot be
 * loaded the label prints PRIVATE CLIENT rather than risk a name.
 *
 * @example
 *   const labelOwner = useLabelOwner();
 *   const owner = await labelOwner({ id: loc.ownerId, name: loc.ownerName });
 *
 * @returns An async resolver from owner to label text
 */
const useLabelOwner = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  return useCallback(
    async (owner: { id?: string | null; name?: string | null }) => {
      try {
        const hidden = await queryClient.fetchQuery({
          ...api.wms.admin.labels.getHiddenOwners.queryOptions(),
          staleTime: 60_000,
        });
        return labelOwnerText(owner, hidden);
      } catch (error) {
        console.error('Could not load hidden label owners', { error });
        return labelOwnerText(owner, null);
      }
    },
    [api, queryClient],
  );
};

export default useLabelOwner;
