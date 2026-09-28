'use client';

import { IconAlertTriangle, IconCopy } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import Checkbox from '@/app/_ui/components/Checkbox/Checkbox';
import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import DialogDescription from '@/app/_ui/components/Dialog/DialogDescription';
import DialogFooter from '@/app/_ui/components/Dialog/DialogFooter';
import DialogHeader from '@/app/_ui/components/Dialog/DialogHeader';
import DialogTitle from '@/app/_ui/components/Dialog/DialogTitle';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import TextArea from '@/app/_ui/components/TextArea/TextArea';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

export interface CloneOrderDialogProps {
  orderId: string;
  orderNumber: string;
  partnerId: string | null;
  /** The source order's own client, left out of the list — they have their box */
  clientId: string | null;
  /** The subscription box this order is, e.g. "Discovery 3 · Mix" */
  boxLabel: string | null;
}

interface NewClient {
  name: string;
  email?: string;
  phone?: string;
}

const money = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);

/**
 * "Name, email, phone" per line — the shape a list pasted from a sheet or a
 * message arrives in. Anything that is not an email or a number is the name.
 */
const parseNewClients = (text: string): NewClient[] =>
  text
    .split('\n')
    .map((line) => line.split(/[,\t]/).map((part) => part.trim()).filter(Boolean))
    .filter((parts) => parts.length > 0)
    .map((parts) => ({
      name: parts.find((p) => !p.includes('@') && !/^\+?[\d\s()-]{7,}$/.test(p)) ?? parts[0]!,
      email: parts.find((p) => p.includes('@')),
      phone: parts.find((p) => /^\+?[\d\s()-]{7,}$/.test(p)),
    }));

/**
 * Clone an order for a list of clients
 *
 * Built for a subscription month: one order per box is made and checked, then
 * copied for everyone else on that box. The preview answers the two questions
 * worth asking before fifteen orders exist — is this box the right number of
 * bottles, and is there enough of every wine for all of them.
 */
const CloneOrderDialog = ({
  orderId,
  orderNumber,
  partnerId,
  clientId,
  boxLabel,
}: CloneOrderDialogProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pasted, setPasted] = useState('');
  const [created, setCreated] = useState<
    { id: string; orderNumber: string; clientName: string }[] | null
  >(null);

  const clientsQuery = useQuery({
    ...api.privateClientContacts.adminGetAll.queryOptions({
      partnerId: partnerId ?? undefined,
      limit: 500,
    }),
    enabled: open && Boolean(partnerId),
  });

  const clients = useMemo(
    () =>
      (clientsQuery.data?.rows ?? [])
        .filter((c) => c.id !== clientId)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [clientsQuery.data, clientId],
  );

  const visible = clients.filter((c) =>
    [c.name, c.email, c.phone]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(search.trim().toLowerCase())),
  );

  const newClients = parseNewClients(pasted);
  const copies = selected.size + newClients.length;

  const previewQuery = useQuery({
    ...api.privateClientOrders.adminClonePreview.queryOptions({ orderId, copies }),
    enabled: open,
  });
  const preview = previewQuery.data;

  const shortLines = (preview?.lines ?? []).filter(
    (l) => l.available !== null && l.available < l.bottlesNeeded,
  );
  const uncodedLines = (preview?.lines ?? []).filter((l) => !l.lwin);

  const { mutate: cloneOrder, isPending } = useMutation(
    api.privateClientOrders.adminCloneOrder.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          `Created ${result.orders.length} draft order${result.orders.length === 1 ? '' : 's'} from ${result.sourceOrderNumber}`,
        );
        setCreated(result.orders);
        setSelected(new Set());
        setPasted('');
        void queryClient.invalidateQueries({
          queryKey: api.privateClientOrders.adminGetMany.queryKey(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleClone = () => {
    const chosen = clients
      .filter((c) => selected.has(c.id))
      .map((c) => ({ clientId: c.id, name: c.name }));

    cloneOrder({ orderId, clients: [...chosen, ...newClients] });
  };

  const close = () => {
    setOpen(false);
    setCreated(null);
    setSearch('');
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Icon icon={IconCopy} size="sm" />
        Clone for clients
      </Button>

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent className="w-full sm:w-[48rem]">
          <DialogHeader>
            <DialogTitle>
              Clone {orderNumber}
              {boxLabel ? ` · ${boxLabel}` : ''}
            </DialogTitle>
            <DialogDescription>
              Each client gets a new draft order with exactly these lines and
              prices{boxLabel ? ', tagged as the same box' : ''}. Check this
              order once; the clones match it.
              {!boxLabel &&
                ' This order has no subscription box set — set one first so the clones are tagged.'}
            </DialogDescription>
          </DialogHeader>

          {created ? (
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
              <Typography variant="bodySm" className="font-medium">
                {created.length} draft order{created.length === 1 ? '' : 's'} created
              </Typography>
              <ul className="divide-border-muted divide-y rounded-lg border border-border-muted">
                {created.map((o) => (
                  <li key={o.id} className="flex items-center justify-between px-3 py-2">
                    <Typography variant="bodySm">{o.clientName}</Typography>
                    <Link
                      href={`/platform/admin/private-orders/${o.id}`}
                      className="text-text-brand text-sm hover:underline"
                    >
                      {o.orderNumber}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
              {/* What one box is, and what the batch needs */}
              {preview && (
                <div className="rounded-lg border border-border-muted">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-muted px-3 py-2">
                    <Typography variant="bodySm" className="font-medium">
                      Box: {preview.bottlesPerBox} bottle
                      {preview.bottlesPerBox === 1 ? '' : 's'} ·{' '}
                      {money(preview.boxTotalUsd)} in-bond
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted">
                      Batch: {preview.boxes} box{preview.boxes === 1 ? '' : 'es'} (this
                      order + {copies})
                    </Typography>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-text-muted text-left text-xs">
                        <th className="px-3 py-1.5 font-medium">Wine</th>
                        <th className="px-3 py-1.5 text-right font-medium">Per box</th>
                        <th className="px-3 py-1.5 text-right font-medium">Needed</th>
                        <th className="px-3 py-1.5 text-right font-medium">On hand</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.lines.map((line) => {
                        const short =
                          line.available !== null && line.available < line.bottlesNeeded;
                        return (
                          <tr key={line.id} className="border-t border-border-muted">
                            <td className="px-3 py-1.5">
                              {line.productName}
                              {line.vintage ? ` ${line.vintage}` : ''}
                            </td>
                            <td className="px-3 py-1.5 text-right">{line.bottlesPerBox}</td>
                            <td className="px-3 py-1.5 text-right">{line.bottlesNeeded}</td>
                            <td
                              className={`px-3 py-1.5 text-right ${short ? 'text-text-danger font-medium' : ''}`}
                            >
                              {line.available ?? 'no LWIN'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {(shortLines.length > 0 || uncodedLines.length > 0) && (
                <div className="flex items-start gap-2 rounded-lg border border-fill-warning/50 bg-fill-warning/5 px-3 py-2">
                  <Icon
                    icon={IconAlertTriangle}
                    size="sm"
                    className="mt-0.5 shrink-0 text-fill-warning"
                  />
                  <Typography variant="bodyXs" className="text-text-muted">
                    {shortLines.length > 0 && (
                      <>
                        <span className="font-medium text-text-primary">
                          Not enough stock on hand for {shortLines.length} wine
                          {shortLines.length === 1 ? '' : 's'}.
                        </span>{' '}
                      </>
                    )}
                    {uncodedLines.length > 0 &&
                      `${uncodedLines.length} line${uncodedLines.length === 1 ? ' has' : 's have'} no LWIN, so stock can't be checked — code it on this order first and every clone inherits it. `}
                    On-hand stock only; other open orders aren&rsquo;t subtracted.
                  </Typography>
                </div>
              )}

              {/* Saved clients */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Typography variant="bodySm" className="font-medium">
                    Saved clients
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    {selected.size} selected
                  </Typography>
                </div>
                <Input
                  placeholder="Search clients"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="max-h-56 overflow-y-auto rounded-lg border border-border-muted">
                  {clientsQuery.isLoading ? (
                    <Typography variant="bodyXs" colorRole="muted" className="p-3">
                      Loading clients…
                    </Typography>
                  ) : visible.length === 0 ? (
                    <Typography variant="bodyXs" colorRole="muted" className="p-3">
                      No clients found
                    </Typography>
                  ) : (
                    visible.map((client) => (
                      <label
                        key={client.id}
                        className="hover:bg-fill-muted/40 flex cursor-pointer items-start gap-3 border-b border-border-muted px-3 py-2 last:border-b-0"
                      >
                        <Checkbox
                          checked={selected.has(client.id)}
                          onCheckedChange={() => toggle(client.id)}
                          className="mt-0.5"
                        />
                        <span className="flex flex-col">
                          <span className="text-text-primary text-sm">
                            {client.name}
                            {client.verifiedAt ? '' : ' · not yet verified'}
                          </span>
                          <span className="text-text-muted text-xs">
                            {[client.email, client.phone, client.address]
                              .filter(Boolean)
                              .join(' · ') || 'no contact details on file'}
                          </span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* New clients */}
              <div className="flex flex-col gap-2">
                <Typography variant="bodySm" className="font-medium">
                  New clients
                </Typography>
                <TextArea
                  rows={3}
                  placeholder={'One per line: Name, email, phone\nJane Smith, jane@example.com, +971 50 123 4567'}
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                />
                {newClients.length > 0 && (
                  <Typography variant="bodyXs" colorRole="muted">
                    {newClients.length} new: {newClients.map((c) => c.name).join(', ')}
                  </Typography>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            {created ? (
              <Button onClick={close}>Done</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={close}>
                  Cancel
                </Button>
                <Button onClick={handleClone} disabled={copies === 0 || isPending}>
                  {isPending
                    ? 'Creating…'
                    : `Create ${copies} draft order${copies === 1 ? '' : 's'}`}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CloneOrderDialog;
