'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import useTRPC from '@/lib/trpc/browser';

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

type Filter = 'all' | 'draft' | 'issued' | 'cancelled';

/**
 * Export invoices, drafts and issued, newest first
 *
 * A table on wide screens, cards on a phone. Filter by status, search by
 * number, consignee or invoice.
 */
const ExportInvoicesListClient = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(api.exportInvoices.admin.getMany.queryOptions());
  const [confirming, setConfirming] = useState<{ id: string; reason: string } | null>(null);
  const done = (message: string) => () => {
    toast.success(message);
    setConfirming(null);
    void queryClient.invalidateQueries({ queryKey: api.exportInvoices.admin.getMany.queryKey() });
  };
  const deleteMutation = useMutation({
    ...api.exportInvoices.admin.deleteDraft.mutationOptions(),
    onSuccess: done('Draft deleted'),
    onError: (error) => toast.error(error.message),
  });
  const cancelMutation = useMutation({
    ...api.exportInvoices.admin.cancelIssued.mutationOptions(),
    onSuccess: done('Export invoice cancelled'),
    onError: (error) => toast.error(error.message),
  });

  /** Delete for a draft, cancel (with a reason) for an issued document */
  const actions = (row: { id: string; status: string; number: string | null }) => {
    if (row.status === 'cancelled') return null;
    const isDraft = row.status === 'draft';
    if (confirming?.id !== row.id) {
      return (
        <Button size="xs" variant="ghost" onClick={(e) => { e.preventDefault(); setConfirming({ id: row.id, reason: '' }); }}>
          {isDraft ? 'Delete' : 'Cancel'}
        </Button>
      );
    }
    return (
      <span className="flex flex-wrap items-center justify-end gap-1.5 text-xs" onClick={(e) => e.preventDefault()}>
        {isDraft ? (
          <span>Delete this draft?</span>
        ) : (
          <input
            autoFocus
            value={confirming.reason}
            onChange={(e) => setConfirming({ id: row.id, reason: e.target.value })}
            placeholder="Reason for cancelling"
            className="w-44 rounded-md border border-border-primary bg-fill-primary px-2 py-1"
          />
        )}
        <Button
          size="xs"
          colorRole="danger"
          disabled={(!isDraft && confirming.reason.trim().length < 3) || deleteMutation.isPending || cancelMutation.isPending}
          onClick={() => (isDraft ? deleteMutation.mutate({ id: row.id }) : cancelMutation.mutate({ id: row.id, reason: confirming.reason.trim() }))}
        >
          {isDraft ? 'Delete' : `Cancel ${row.number ?? ''}`}
        </Button>
        <Button size="xs" variant="ghost" onClick={() => setConfirming(null)}>Keep</Button>
      </span>
    );
  };
  const badge = (status: string) => (
    <Badge colorRole={status === 'issued' ? 'success' : status === 'cancelled' ? 'danger' : 'warning'} size="sm">
      {status === 'issued' ? 'Issued' : status === 'cancelled' ? 'Cancelled' : 'Draft'}
    </Badge>
  );
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const term = search.trim().toLowerCase();
  const rows = (data ?? []).filter(
    (r) =>
      (filter === 'all' || r.status === filter) &&
      (!term ||
        (r.number ?? 'draft').toLowerCase().includes(term) ||
        r.consigneeName.toLowerCase().includes(term) ||
        r.invoices.some((i) => i.toLowerCase().includes(term))),
  );
  const count = (f: Filter) => (data ?? []).filter((r) => f === 'all' || r.status === f).length;
  const invoiceList = (invoices: string[]) =>
    invoices.length > 4 ? `${invoices.slice(0, 4).join(', ')} +${invoices.length - 4} more` : invoices.join(', ');

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-border-muted bg-fill-muted/30 p-1">
          {(['all', 'draft', 'issued', 'cancelled'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-sm capitalize ${filter === f ? 'bg-fill-primary font-medium shadow-xs' : 'text-text-muted'}`}
            >
              {f === 'all' ? 'All' : f === 'draft' ? 'Drafts' : f === 'issued' ? 'Issued' : 'Cancelled'} <span className="text-xs text-text-muted">{count(f)}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search number, consignee, invoice"
            className="min-w-0 flex-1 rounded-lg border border-border-primary bg-fill-primary px-3 py-2 text-sm sm:w-72"
          />
          <Button colorRole="brand" size="sm" asChild>
            <Link href="/platform/admin/logistics/export-invoices/new">New</Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-fill-muted/50" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-muted p-10 text-center">
          <p className="text-sm text-text-muted">
            {data?.length ? 'Nothing matches.' : 'No export invoices yet.'}
          </p>
          {!data?.length && (
            <Button colorRole="brand" size="sm" className="mx-auto mt-3" asChild>
              <Link href="/platform/admin/logistics/export-invoices/new">Start from a consignee&rsquo;s invoices</Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-border-muted bg-fill-primary md:block">
            <table className="w-full text-sm">
              <thead className="bg-fill-muted/50 text-left text-[11px] uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-4 py-2.5">Number</th>
                  <th className="px-4 py-2.5">Consignee</th>
                  <th className="px-4 py-2.5">Invoices</th>
                  <th className="px-4 py-2.5 text-right">Cases</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border-muted">
                {rows.map((row) => (
                  <tr key={row.id} className={`hover:bg-fill-muted/30 ${row.status === 'cancelled' ? 'text-text-muted line-through decoration-text-muted/40' : ''}`}>
                    <td className="px-4 py-3 font-semibold">
                      <Link href={`/platform/admin/logistics/export-invoices/${row.id}`} className="hover:underline">
                        {row.number ?? 'Draft'}
                      </Link>
                      <p className="text-xs font-normal text-text-muted">
                        {new Date(row.issuedAt ?? row.createdAt).toLocaleDateString('en-GB')}
                      </p>
                    </td>
                    <td className="px-4 py-3">{row.consigneeName}</td>
                    <td className="max-w-xs px-4 py-3 text-xs text-text-muted">{invoiceList(row.invoices)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.cases ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {row.total === null ? '—' : `${row.currency} ${money(row.total)}`}
                    </td>
                    <td className="px-4 py-3">{badge(row.status)}</td>
                    <td className="px-4 py-3 text-right">{actions(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 md:hidden">
            {rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/platform/admin/logistics/export-invoices/${row.id}`}
                  className="block rounded-xl border border-border-muted bg-fill-primary p-3 active:bg-fill-muted/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{row.number ?? 'Draft'}</p>
                      <p className="text-xs text-text-muted">{row.consigneeName}</p>
                    </div>
                    {badge(row.status)}
                  </div>
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <p className="text-xs text-text-muted">{invoiceList(row.invoices)}</p>
                    <p className="shrink-0 text-right text-sm font-medium tabular-nums">
                      {row.total === null ? '—' : `${row.currency} ${money(row.total)}`}
                      <span className="block text-xs font-normal text-text-muted">{row.cases ?? '—'} cases</span>
                    </p>
                  </div>
                </Link>
                {row.status !== 'cancelled' && <div className="mt-1 flex justify-end">{actions(row)}</div>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default ExportInvoicesListClient;
