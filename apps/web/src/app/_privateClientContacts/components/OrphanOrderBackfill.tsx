'use client';

import { IconAlertTriangle } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';

type Preview = {
  ordersAffected: number;
  clients: number;
  details: { name: string; partnerName: string | null; orderNumbers: string[] }[];
};

/**
 * Give the orders raised before the create paths kept a client one now.
 *
 * Shown only when there is something to fix, and it previews before it writes:
 * this rewrites orders across every partner's book, and seeing the list first
 * is the difference between a repair and a surprise.
 */
const OrphanOrderBackfill = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<Preview | null>(null);

  const backfill = useMutation({
    ...api.privateClientContacts.adminBackfillOrderClients.mutationOptions(),
    onSuccess: (result) => {
      if (result.applied) {
        toast.success(
          `${result.ordersAffected} order${result.ordersAffected === 1 ? '' : 's'} linked · ${result.created} client${result.created === 1 ? '' : 's'} created, ${result.reused} reused`,
        );
        setPreview(null);
        void queryClient.invalidateQueries();
        return;
      }

      if (result.ordersAffected === 0) {
        toast.success('Every order already has a client record');
        setPreview(null);
        return;
      }

      setPreview(result);
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2.5">
          <IconAlertTriangle className="mt-0.5 h-4 w-4 flex-none text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              Orders with no client record
            </p>
            <p className="mt-0.5 max-w-prose text-[13px] text-amber-900/80">
              Orders raised before clients were kept automatically have their
              details typed on but no record behind them, so they cannot be
              corrected or marked verified — which is how orders get stuck in
              verification. This gives each one a record, reusing an existing
              client of that partner where the name matches.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={backfill.isPending}
          onClick={() => backfill.mutate({ apply: false })}
          className="flex-none rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-[13px] font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-50"
        >
          {backfill.isPending && !preview ? 'Checking…' : 'Check'}
        </button>
      </div>

      {preview && (
        <div className="mt-4 border-t border-amber-200 pt-3">
          <p className="text-[13px] font-medium text-amber-900">
            {preview.ordersAffected} order
            {preview.ordersAffected === 1 ? '' : 's'} across {preview.clients}{' '}
            client{preview.clients === 1 ? '' : 's'}
          </p>

          <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-amber-200 bg-white">
            <table className="w-full text-[12.5px]">
              <tbody className="divide-y divide-amber-100">
                {preview.details.map((row) => (
                  <tr key={`${row.partnerName}-${row.name}`}>
                    <td className="px-3 py-1.5 font-medium">{row.name}</td>
                    <td className="px-3 py-1.5 text-text-muted">
                      {row.partnerName ?? '—'}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-text-muted">
                      {row.orderNumbers.length} order
                      {row.orderNumbers.length === 1 ? '' : 's'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled={backfill.isPending}
              onClick={() => backfill.mutate({ apply: true })}
              className="rounded-lg bg-amber-600 px-3.5 py-1.5 text-[13px] font-bold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {backfill.isPending ? 'Linking…' : 'Create the records'}
            </button>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="rounded-lg px-3 py-1.5 text-[13px] text-amber-900/70 hover:text-amber-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrphanOrderBackfill;
