'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import Checkbox from '@/app/_ui/components/Checkbox/Checkbox';
import useTRPC from '@/lib/trpc/browser';

export interface HideNameOnLabelsToggleProps {
  partnerId: string;
}

/**
 * Switch a partner's warehouse labels to their reference instead of their name
 *
 * Saves on its own, separately from the rest of the edit form, because it
 * changes what the warehouse prints from that moment.
 */
const HideNameOnLabelsToggle = ({ partnerId }: HideNameOnLabelsToggleProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const hiddenQuery = api.wms.admin.labels.getHiddenOwners.queryOptions();
  const { data: hidden, isLoading } = useQuery(hiddenQuery);
  const entry = hidden?.find((h) => h.partnerId === partnerId);

  const { mutate, isPending } = useMutation({
    ...api.partners.setHideNameOnLabels.mutationOptions(),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: hiddenQuery.queryKey });
      toast.success(
        result.hide
          ? `Labels will show ${result.code ?? 'PRIVATE CLIENT'} instead of the name`
          : 'Labels will show the partner name',
      );
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border-muted p-3">
      <Checkbox
        id={`hide-name-${partnerId}`}
        checked={!!entry}
        isDisabled={isLoading || isPending || entry?.isPrivateCollector}
        onCheckedChange={(value) => mutate({ partnerId, hide: value === true })}
        className="mt-0.5"
      />
      <label htmlFor={`hide-name-${partnerId}`} className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-text-primary">
          Hide name on labels
          {entry?.code && (
            <span className="ml-2 rounded bg-fill-muted px-1.5 py-px font-mono text-xs">
              {entry.code}
            </span>
          )}
        </span>
        <span className="text-xs text-text-muted">
          {entry?.isPrivateCollector
            ? 'Always on for Private Cellar members.'
            : 'Warehouse labels print this partner’s reference instead of their name. Use when a partner asks for discreet labels.'}
        </span>
      </label>
    </div>
  );
};

export default HideNameOnLabelsToggle;
