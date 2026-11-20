'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';

import { RELEASE_TYPE_LABELS } from '../utils/resolveReleaseType';
import type { ReleaseType } from '../utils/resolveReleaseType';

export interface ReleaseTypePickerProps {
  salesOrderId: string;
  type: ReleaseType | null;
  required: boolean;
  reason: string;
}

const CHOICES: ReleaseType[] = ['consignment', 'outright', 'prepaid'];

/**
 * What a City Drinks order is being released as, chosen before release
 *
 * Shown only where the order cannot answer for itself. Orders that can (a
 * PCO, a non-consignment customer, a tagged consignment order) show their
 * type as a quiet label instead.
 */
const ReleaseTypePicker = ({ salesOrderId, type, required, reason }: ReleaseTypePickerProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const setType = useMutation(
    api.zohoSalesOrders.setReleaseType.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: api.zohoSalesOrders.releaseTypes.queryKey(),
        }),
      onError: (error) => toast.error(error.message),
    }),
  );

  if (!required && type && reason !== 'Set at release' && reason !== 'Tagged consignment in Zoho') {
    return null;
  }

  return (
    <select
      value={type ?? ''}
      disabled={setType.isPending}
      title={reason}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => {
        event.stopPropagation();
        setType.mutate({
          salesOrderId,
          releaseType: event.target.value as ReleaseType,
        });
      }}
      className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
        type
          ? 'bg-fill-secondary text-text-muted'
          : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
      }`}
    >
      {!type ? <option value="">Choose type…</option> : null}
      {CHOICES.map((choice) => (
        <option key={choice} value={choice}>
          {RELEASE_TYPE_LABELS[choice]}
        </option>
      ))}
    </select>
  );
};

export default ReleaseTypePicker;
