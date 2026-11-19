'use client';

import { IconTruckDelivery } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

export interface WarehouseUpdatesSectionProps {
  partnerId: string;
}

/**
 * A distributor's warehouse updates: on or off, how picked & packed updates
 * reach them, the end-of-day summary, and who receives them
 */
const WarehouseUpdatesSection = ({ partnerId }: WarehouseUpdatesSectionProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const queryOptions = api.privateClientOrders.adminGetWarehouseUpdateSettings.queryOptions({ partnerId });
  const { data } = useQuery(queryOptions);

  const save = useMutation({
    ...api.privateClientOrders.adminSetWarehouseUpdateSettings.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryOptions.queryKey });
      toast.success('Warehouse updates saved');
    },
    onError: (error) => toast.error(error.message),
  });

  const current = {
    enabled: data?.enabled ?? false,
    picked: data?.picked ?? ('grouped' as const),
    summary: data?.summary ?? true,
  };
  const change = (next: Partial<typeof current>) => save.mutate({ partnerId, ...current, ...next });
  const disabled = !data || save.isPending;

  return (
    <div className="space-y-3 border-t border-border-muted pt-4">
      <Typography variant="bodySm" className="flex items-center gap-2 font-semibold">
        <IconTruckDelivery className="h-4 w-4" />
        Warehouse updates
      </Typography>
      <Typography variant="bodyXs" colorRole="muted">
        Emails when their orders are picked and packed, ready for dispatch, or held up, and a summary at 17:00 Gulf
        time, Monday to Saturday.
        {data?.mode !== 'live' &&
          (data?.mode === 'shadow'
            ? ' The switch on Order Emails is in shadow: they go to Kevin for now.'
            : ' The switch on Order Emails is off: nothing is sent yet.')}
      </Typography>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={current.enabled} disabled={disabled} onChange={(e) => change({ enabled: e.target.checked })} />
        Send warehouse updates to this distributor
      </label>

      {current.enabled && (
        <div className="bg-fill-muted space-y-3 rounded-lg p-3">
          <fieldset className="space-y-1.5">
            <legend className="text-text-muted mb-1 text-xs font-medium">Picked and packed</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`picked-${partnerId}`}
                checked={current.picked === 'grouped'}
                disabled={disabled}
                onChange={() => change({ picked: 'grouped' })}
              />
              Grouped, at 11:00 and 16:00
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`picked-${partnerId}`}
                checked={current.picked === 'immediate'}
                disabled={disabled}
                onChange={() => change({ picked: 'immediate' })}
              />
              Straight away, one email per order
            </label>
          </fieldset>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={current.summary} disabled={disabled} onChange={(e) => change({ summary: e.target.checked })} />
            End-of-day summary at 17:00
          </label>

          <div className="text-xs">
            <p className="text-text-muted font-medium">Sent to</p>
            {data?.recipients.length ? (
              <p className="text-text-primary">{data.recipients.map((r) => `${r.name || r.email} <${r.email}>`).join(', ')}</p>
            ) : (
              <p className="text-red-700 dark:text-red-300">
                Nobody yet. Add a contact above with the role Logistics, or Purchasing, or set a business email.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WarehouseUpdatesSection;
