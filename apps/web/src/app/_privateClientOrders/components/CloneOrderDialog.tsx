'use client';

import {
  IconAlertTriangle,
  IconCheck,
  IconCopy,
  IconPlus,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
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

import formatSubscriptionBox from '../utils/formatSubscriptionBox';

export interface CloneOrderDialogProps {
  orderId: string;
  orderNumber: string;
  partnerId: string | null;
  /** The source order's own client, left out of the list — they have their box */
  clientId: string | null;
  subscriptionTier: string | null;
  subscriptionCaseSize: number | null;
  subscriptionVariant: string | null;
}

interface NewClient {
  name: string;
  email?: string;
  phone?: string;
}

/** A client with an order for this box this recent already has this month's */
const RECENT_BOX_DAYS = 25;

const PHONE = /^\+?[\d\s()-]{7,}$/;

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
      name: parts.find((p) => !p.includes('@') && !PHONE.test(p)) ?? parts[0]!,
      email: parts.find((p) => p.includes('@')),
      phone: parts.find((p) => PHONE.test(p)),
    }));

/**
 * Clone an order for a list of clients
 *
 * Built for a subscription month: one order per box is made and checked, then
 * copied for everyone else on that box. Clients are chosen on the left; the
 * right keeps the batch in view — what one box is, whether there is stock for
 * all of it, and who is in — so nothing needs scrolling back to before
 * committing. Clients who already have this box from the last few weeks are
 * held back, since a second one is a double shipment rather than a choice.
 */
const CloneOrderDialog = ({
  orderId,
  orderNumber,
  partnerId,
  clientId,
  subscriptionTier,
  subscriptionCaseSize,
  subscriptionVariant,
}: CloneOrderDialogProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showPaste, setShowPaste] = useState(false);
  const [pasted, setPasted] = useState('');
  const [created, setCreated] = useState<
    { id: string; orderNumber: string; clientName: string }[] | null
  >(null);

  const boxLabel = formatSubscriptionBox({
    subscriptionTier,
    subscriptionCaseSize,
    subscriptionVariant,
  });

  const clientsQuery = useQuery({
    ...api.privateClientContacts.adminGetAll.queryOptions({
      partnerId: partnerId ?? undefined,
      limit: 500,
    }),
    enabled: open && Boolean(partnerId),
  });

  // Orders already on this box, to hold back anyone who has this month's
  const boxOrdersQuery = useQuery({
    ...api.privateClientOrders.adminGetMany.queryOptions({
      limit: 100,
      box: subscriptionTier
        ? {
            tier: subscriptionTier,
            caseSize: subscriptionCaseSize,
            variant: subscriptionVariant,
          }
        : undefined,
    }),
    enabled: open && Boolean(subscriptionTier),
  });

  const hasBox = useMemo(() => {
    const since = Date.now() - RECENT_BOX_DAYS * 24 * 60 * 60 * 1000;
    const map = new Map<string, string>();
    for (const order of boxOrdersQuery.data?.data ?? []) {
      if (!order.clientId || order.status === 'cancelled') continue;
      if (new Date(order.createdAt).getTime() < since) continue;
      if (!map.has(order.clientId)) map.set(order.clientId, order.orderNumber);
    }
    return map;
  }, [boxOrdersQuery.data]);

  const clients = useMemo(
    () =>
      (clientsQuery.data?.rows ?? [])
        .filter((c) => c.id !== clientId)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [clientsQuery.data, clientId],
  );

  const term = search.trim().toLowerCase();
  const visible = clients.filter((c) =>
    [c.name, c.email, c.phone]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(term)),
  );
  const selectable = visible.filter((c) => !hasBox.has(c.id));

  const newClients = parseNewClients(pasted);
  const copies = selected.size + newClients.length;

  const previewQuery = useQuery({
    ...api.privateClientOrders.adminClonePreview.queryOptions({ orderId, copies }),
    enabled: open,
    placeholderData: (previous) => previous,
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
        void queryClient.invalidateQueries({
          queryKey: api.privateClientOrders.adminGetSubscriptionBoxes.queryKey(),
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

  const selectAllVisible = () =>
    setSelected((prev) => new Set([...prev, ...selectable.map((c) => c.id)]));

  const selectedClients = clients.filter((c) => selected.has(c.id));

  const handleClone = () =>
    cloneOrder({
      orderId,
      clients: [
        ...selectedClients.map((c) => ({ clientId: c.id, name: c.name })),
        ...newClients,
      ],
    });

  const close = () => {
    setOpen(false);
    setCreated(null);
    setSearch('');
    setShowPaste(false);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Icon icon={IconCopy} size="sm" />
        Clone for clients
      </Button>

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent className="w-full sm:w-[60rem]">
          <DialogHeader>
            <DialogTitle>
              Clone {orderNumber}
              {boxLabel && (
                <span className="ml-2 inline-flex items-center rounded-full bg-fill-brand/10 px-2 py-0.5 align-middle text-sm font-medium text-text-brand">
                  {boxLabel}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              {boxLabel
                ? 'Each client gets a draft order with these exact lines and prices, tagged with the same box.'
                : 'Each client gets a draft order with these exact lines and prices.'}
            </DialogDescription>
          </DialogHeader>

          {!boxLabel && !created && (
            <div className="flex items-start gap-2 rounded-lg border border-fill-warning/50 bg-fill-warning/5 px-3 py-2">
              <Icon icon={IconAlertTriangle} size="sm" className="mt-0.5 shrink-0 text-fill-warning" />
              <Typography variant="bodyXs" className="text-text-muted">
                <span className="font-medium text-text-primary">No subscription box set.</span>{' '}
                Close this, set the box on the order, then clone — or the clones
                won&rsquo;t be tagged.
              </Typography>
            </div>
          )}

          {created ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-fill-success/15">
                  <Icon icon={IconCheck} size="sm" className="text-text-success" />
                </span>
                <Typography variant="bodySm" className="font-medium">
                  {created.length} draft order{created.length === 1 ? '' : 's'} created
                  {boxLabel ? ` · ${boxLabel}` : ''}
                </Typography>
              </div>
              <ul className="divide-y divide-border-muted rounded-lg border border-border-muted">
                {created.map((o) => (
                  <li key={o.id} className="flex items-center justify-between px-3 py-2">
                    <Typography variant="bodySm">{o.clientName}</Typography>
                    <Link
                      href={`/platform/admin/private-orders/${o.id}`}
                      className="text-sm text-text-brand hover:underline"
                    >
                      {o.orderNumber}
                    </Link>
                  </li>
                ))}
              </ul>
              <Typography variant="bodyXs" colorRole="muted">
                Edit any member&rsquo;s swaps on their own order, then submit
                each as usual.
              </Typography>
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto md:grid-cols-[1fr_19rem] md:overflow-hidden">
              {/* Left: who gets a box */}
              <div className="flex min-h-0 flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Icon
                      icon={IconSearch}
                      size="sm"
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                    />
                    <Input
                      placeholder="Search name, email or phone"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectAllVisible}
                    disabled={selectable.length === 0}
                  >
                    Select all
                  </Button>
                  {selected.size > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                      Clear
                    </Button>
                  )}
                </div>

                <div className="min-h-[12rem] flex-1 overflow-y-auto rounded-lg border border-border-muted md:max-h-[22rem]">
                  {clientsQuery.isLoading ? (
                    <Typography variant="bodyXs" colorRole="muted" className="p-3">
                      Loading clients…
                    </Typography>
                  ) : visible.length === 0 ? (
                    <Typography variant="bodyXs" colorRole="muted" className="p-3">
                      {term ? `No clients match “${search.trim()}”` : 'No saved clients yet'}
                    </Typography>
                  ) : (
                    visible.map((client) => {
                      const existing = hasBox.get(client.id);
                      const isSelected = selected.has(client.id);
                      return (
                        <label
                          key={client.id}
                          className={`flex items-center gap-3 border-b border-border-muted px-3 py-2 last:border-b-0 ${
                            existing
                              ? 'cursor-not-allowed opacity-60'
                              : `cursor-pointer hover:bg-fill-muted/40 ${isSelected ? 'bg-fill-brand/5' : ''}`
                          }`}
                        >
                          <Checkbox
                            checked={isSelected}
                            disabled={Boolean(existing)}
                            onCheckedChange={() => toggle(client.id)}
                          />
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="flex items-center gap-1.5 text-sm text-text-primary">
                              <span className="truncate">{client.name}</span>
                              {!client.verifiedAt && (
                                <span className="shrink-0 rounded-full bg-fill-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-text-warning">
                                  Unverified
                                </span>
                              )}
                            </span>
                            <span className="truncate text-xs text-text-muted">
                              {existing
                                ? `Already has this box · ${existing}`
                                : [client.email, client.phone, client.address]
                                    .filter(Boolean)
                                    .join(' · ') || 'No contact details on file'}
                            </span>
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>

                {showPaste ? (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <Typography variant="bodyXs" className="font-medium">
                        New clients · one per line
                      </Typography>
                      <button
                        type="button"
                        className="text-xs text-text-muted hover:text-text-primary"
                        onClick={() => {
                          setShowPaste(false);
                          setPasted('');
                        }}
                      >
                        Remove
                      </button>
                    </div>
                    <TextArea
                      rows={3}
                      placeholder="Jane Smith, jane@example.com, +971 50 123 4567"
                      value={pasted}
                      onChange={(e) => setPasted(e.target.value)}
                      autoFocus
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowPaste(true)}
                    className="flex items-center gap-1.5 self-start text-sm text-text-brand hover:underline"
                  >
                    <Icon icon={IconPlus} size="sm" />
                    Add clients not on the list
                  </button>
                )}
              </div>

              {/* Right: the batch */}
              <div className="flex min-h-0 flex-col gap-3 overflow-y-auto rounded-lg bg-fill-secondary/40 p-3">
                <div>
                  <Typography variant="bodyXs" colorRole="muted" className="uppercase tracking-wide">
                    Each box
                  </Typography>
                  <Typography variant="bodySm" className="font-medium">
                    {preview
                      ? `${preview.bottlesPerBox} bottle${preview.bottlesPerBox === 1 ? '' : 's'} · ${money(preview.boxTotalUsd)} in-bond`
                      : '…'}
                  </Typography>
                  {preview &&
                    subscriptionCaseSize &&
                    preview.bottlesPerBox !== subscriptionCaseSize && (
                      <Typography variant="bodyXs" className="text-text-warning">
                        Box is a case of {subscriptionCaseSize} but holds{' '}
                        {preview.bottlesPerBox} — check the lines.
                      </Typography>
                    )}
                </div>

                <ul className="flex flex-col gap-2">
                  {(preview?.lines ?? []).map((line) => {
                    const short =
                      line.available !== null && line.available < line.bottlesNeeded;
                    return (
                      <li key={line.id} className="flex items-start justify-between gap-2">
                        <span className="min-w-0 text-xs text-text-primary">
                          <span className="font-medium">{line.bottlesPerBox}×</span>{' '}
                          {line.productName}
                          {line.vintage ? ` ${line.vintage}` : ''}
                        </span>
                        <span
                          className={`shrink-0 text-xs ${
                            line.available === null
                              ? 'text-text-warning'
                              : short
                                ? 'font-medium text-text-danger'
                                : 'text-text-muted'
                          }`}
                          title={
                            line.available === null
                              ? 'No LWIN — stock cannot be checked'
                              : `${line.bottlesNeeded} needed · ${line.available} on hand`
                          }
                        >
                          {line.available === null ? (
                            'No LWIN'
                          ) : short ? (
                            `Short ${line.bottlesNeeded - line.available}`
                          ) : (
                            <span className="inline-flex items-center gap-0.5">
                              <Icon icon={IconCheck} size="xs" className="text-text-success" />
                              {line.bottlesNeeded}/{line.available}
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {(shortLines.length > 0 || uncodedLines.length > 0) && (
                  <Typography variant="bodyXs" className="text-text-warning">
                    {shortLines.length > 0 &&
                      `Not enough stock for ${shortLines.length} wine${shortLines.length === 1 ? '' : 's'}. `}
                    {uncodedLines.length > 0 &&
                      'Code lines without an LWIN on this order — clones inherit it. '}
                  </Typography>
                )}
                <Typography variant="bodyXs" colorRole="muted">
                  Needed/on hand, for this order + {copies} clone{copies === 1 ? '' : 's'}.
                  On-hand only; other open orders aren&rsquo;t subtracted.
                </Typography>

                <div className="border-t border-border-muted pt-3">
                  <Typography variant="bodyXs" colorRole="muted" className="mb-1.5 uppercase tracking-wide">
                    Cloning for {copies}
                  </Typography>
                  {copies === 0 ? (
                    <Typography variant="bodyXs" colorRole="muted">
                      Tick clients on the left.
                    </Typography>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedClients.map((c) => (
                        <span
                          key={c.id}
                          className="inline-flex items-center gap-1 rounded-full bg-fill-primary px-2 py-0.5 text-xs text-text-primary"
                        >
                          {c.name}
                          <button
                            type="button"
                            aria-label={`Remove ${c.name}`}
                            onClick={() => toggle(c.id)}
                            className="text-text-muted hover:text-text-primary"
                          >
                            <Icon icon={IconX} size="xs" />
                          </button>
                        </span>
                      ))}
                      {newClients.map((c, i) => (
                        <span
                          key={`new-${i}`}
                          className="inline-flex items-center rounded-full border border-dashed border-border-muted px-2 py-0.5 text-xs text-text-primary"
                          title="New client — will be saved"
                        >
                          {c.name} · new
                        </span>
                      ))}
                    </div>
                  )}
                </div>
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
                <Button
                  colorRole={copies > 0 ? 'brand' : 'primary'}
                  onClick={handleClone}
                  disabled={copies === 0 || isPending}
                >
                  {isPending
                    ? 'Creating…'
                    : copies === 0
                      ? 'Select clients to clone'
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
