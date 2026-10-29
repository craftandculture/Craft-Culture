'use client';

import { IconFileInvoice } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC, { useTRPCClient } from '@/lib/trpc/browser';

import describePcoLine from '../utils/describePcoLine';

export interface ManualInvoicingCardProps {
  orderId: string;
}

const dateLabel = (value: Date | string | null) =>
  value
    ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

/**
 * Manual invoicing of delivered lines (C&C)
 *
 * Mark lines — some for a part delivery, or the whole order — "Delivered –
 * Manual Invoice Pending", then record the invoice number and date once it is
 * raised, which moves them to "Delivered – Invoiced". Invoiced lines are shown
 * with their invoice and cannot be selected again, so the same delivery is not
 * invoiced twice; the server refuses it as well. Mistakes are undone per line.
 */
const ManualInvoicingCard = ({ orderId }: ManualInvoicingCardProps) => {
  const api = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [recording, setRecording] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));

  const { data, refetch } = useQuery(api.privateClientOrders.adminGetOrderInvoicing.queryOptions({ orderId }));

  const refresh = () => {
    setSelected(new Set());
    void refetch();
    void queryClient.invalidateQueries({ queryKey: ['privateClientOrders'] });
  };

  const markDelivered = useMutation({
    mutationFn: (itemIds?: string[]) =>
      trpcClient.privateClientOrders.adminMarkDeliveredInvoicePending.mutate({ orderId, itemIds }),
    onSuccess: (result) => {
      toast.success(
        result.marked > 0
          ? `${result.marked} line${result.marked === 1 ? '' : 's'} marked Delivered – Manual Invoice Pending`
          : 'Nothing new to mark',
      );
      if (result.skippedInvoiced.length > 0) {
        toast.info(
          `Already invoiced, left as they are: ${result.skippedInvoiced
            .map((s) => `${s.productName} (${s.invoiceNumber})`)
            .join(', ')}`,
        );
      }
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const recordInvoice = useMutation({
    mutationFn: () =>
      trpcClient.privateClientOrders.adminRecordManualInvoice.mutate({
        orderId,
        itemIds: [...selected],
        invoiceNumber,
        invoiceDate: new Date(invoiceDate),
      }),
    onSuccess: (result) => {
      toast.success(`${result.invoiced} line${result.invoiced === 1 ? '' : 's'} invoiced on ${result.invoiceNumber}`);
      setRecording(false);
      setInvoiceNumber('');
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const reset = useMutation({
    mutationFn: (args: { itemId: string; to: 'pending' | 'none' }) =>
      trpcClient.privateClientOrders.adminResetItemInvoicing.mutate({
        orderId,
        itemIds: [args.itemId],
        to: args.to,
      }),
    onSuccess: () => {
      toast.success('Undone');
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  if (!data?.ready || data.items.length === 0) return null;

  const busy = markDelivered.isPending || recordInvoice.isPending || reset.isPending;
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const invoiceable = data.items.filter((item) => item.invoicing?.status !== 'invoiced');

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Icon icon={IconFileInvoice} size="md" colorRole="muted" />
            <div>
              <Typography variant="headingSm">Manual invoicing</Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Mark delivered lines, then record the invoice once it is raised.
              </Typography>
            </div>
          </div>
          {data.label && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                data.label.state === 'pending'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
              }`}
            >
              {data.label.label}
            </span>
          )}
        </div>

        <div className="divide-y divide-border-muted rounded-lg border border-border-muted">
          {data.items.map((item) => {
            const state = item.invoicing?.status ?? null;
            const invoiced = state === 'invoiced';
            const line = describePcoLine(item);
            return (
              <div key={item.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={selected.has(item.id)}
                  disabled={invoiced || busy}
                  onChange={() => toggle(item.id)}
                  aria-label={`Select ${item.productName}`}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-sm font-medium"
                    title={`${item.productName}${item.vintage ? ` ${item.vintage}` : ''}`}
                  >
                    {item.productName}
                    {item.vintage ? ` ${item.vintage}` : ''}
                  </p>
                  <p className="text-xs text-text-muted">{line.qty}</p>
                </div>
                {state === 'pending' && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                    Delivered – Manual Invoice Pending
                  </span>
                )}
                {invoiced && (
                  <span
                    className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                    title="Already invoiced — cannot be invoiced again"
                  >
                    ✓ Invoiced · {item.invoicing?.invoiceNumber} · {dateLabel(item.invoicing?.invoiceDate ?? null)}
                  </span>
                )}
                {state && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      // Removing a recorded invoice puts the line back in the invoicing queue
                      if (
                        invoiced &&
                        !window.confirm(
                          `Remove invoice ${item.invoicing?.invoiceNumber ?? ''} from ${item.productName}? The line goes back to Invoice Pending.`,
                        )
                      ) {
                        return;
                      }
                      reset.mutate({ itemId: item.id, to: invoiced ? 'pending' : 'none' });
                    }}
                    className="text-xs text-text-muted underline-offset-2 hover:underline disabled:opacity-40"
                  >
                    {invoiced ? 'Remove invoice' : 'Undo delivered'}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {recording ? (
          <div className="flex flex-wrap items-end gap-3 rounded-lg bg-fill-muted/40 p-3">
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              Invoice number
              <Input
                autoFocus
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="e.g. INV-000412"
                className="h-9 w-44"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              Invoice date
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="h-9 w-40"
              />
            </label>
            <Button
              size="sm"
              colorRole="brand"
              disabled={!invoiceNumber.trim() || selected.size === 0 || busy}
              onClick={() => recordInvoice.mutate()}
            >
              Record invoice for {selected.size} line{selected.size === 1 ? '' : 's'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRecording(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy || invoiceable.every((i) => i.invoicing)}
              title={
                invoiceable.every((i) => i.invoicing)
                  ? 'Every line is already marked delivered or invoiced'
                  : undefined
              }
              onClick={() => markDelivered.mutate(undefined)}
            >
              Whole order delivered – invoice pending
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || selected.size === 0}
              title={selected.size === 0 ? 'Tick the delivered lines first' : undefined}
              onClick={() => markDelivered.mutate([...selected])}
            >
              Selected delivered – invoice pending ({selected.size})
            </Button>
            <Button
              size="sm"
              colorRole="brand"
              disabled={busy || selected.size === 0}
              title={selected.size === 0 ? 'Tick the lines this invoice covers first' : undefined}
              onClick={() => setRecording(true)}
            >
              Record invoice for selected ({selected.size})
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ManualInvoicingCard;
