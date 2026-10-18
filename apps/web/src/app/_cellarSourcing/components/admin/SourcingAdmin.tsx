'use client';

import { IconPlus, IconRefresh } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { useState } from 'react';
import { toast } from 'sonner';

import ConfirmAction from '@/app/_cellar/components/ConfirmAction';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import useTRPC from '@/lib/trpc/browser';

const money = (value: number) =>
  `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

type Filter = 'act' | 'waiting' | 'buy' | 'all';

const TO_ACT = ['requested', 'searching', 'declined'];

const PILL: Record<string, string> = {
  requested: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300',
  searching: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  offer_sent: 'bg-surface-muted text-text-muted',
  accepted: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300',
  declined: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
  withdrawn: 'bg-surface-muted text-text-muted',
  closed: 'bg-surface-muted text-text-muted',
};

const LABEL: Record<string, string> = {
  requested: 'New',
  searching: 'Searching',
  offer_sent: 'Offer sent',
  accepted: 'Accepted · buy',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
  closed: 'Closed',
};

const field = 'text-text-muted mb-1 block text-[11px] font-semibold uppercase tracking-wide';

interface OfferDraft {
  wineName: string;
  lwin18: string;
  vintage: string;
  caseConfig: string;
  cases: string;
  price: string;
  holdAt: 'uae' | 'uk';
  validUntil: string;
  note: string;
  fromStock: boolean;
}

const emptyAllocation = {
  wineName: '',
  producer: '',
  lwin18: '',
  vintage: '',
  format: '75cl',
  caseConfig: '6',
  price: '',
  totalCases: '',
  maxCases: '',
  closesAt: '',
  deliveryNote: '',
  description: '',
  holdAt: 'uae' as 'uae' | 'uk',
  fromStock: false,
};

const toNumber = (value: string) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * Wines members asked us to find, and allocations offered to members first
 *
 * Exception-first: the default view is what is waiting on us — new requests,
 * ones we are searching for, and offers a member declined. Accepted requests
 * are bought through their Team Tasks job, or reserved at once from stock.
 */
const SourcingAdmin = () => {
  const api = useTRPC();
  const [filter, setFilter] = useState<Filter>('act');
  const [offerFor, setOfferFor] = useState<string | null>(null);
  const [draft, setDraft] = useState<OfferDraft | null>(null);
  const [closeNote, setCloseNote] = useState<Record<string, string>>({});
  const [showNewAllocation, setShowNewAllocation] = useState(false);
  const [allocation, setAllocation] = useState(emptyAllocation);
  const [shares, setShares] = useState<Record<string, string>>({});

  const { data, refetch, isLoading, isRefetching } = useQuery({
    ...api.cellarSourcing.admin.get.queryOptions(),
  });

  const onError = (error: { message: string }) => toast.error(error.message);

  const { mutate: updateRequest, isPending: isUpdating } = useMutation(
    api.cellarSourcing.admin.updateRequest.mutationOptions({
      onSuccess: () => void refetch(),
      onError,
    }),
  );

  const { mutate: sendOffer, isPending: isSending } = useMutation(
    api.cellarSourcing.admin.sendOffer.mutationOptions({
      onSuccess: (result) => {
        toast.success(`Offer sent for ${result.requestNumber}`);
        setOfferFor(null);
        setDraft(null);
        void refetch();
      },
      onError,
    }),
  );

  const { mutate: createAllocation, isPending: isCreating } = useMutation(
    api.cellarSourcing.admin.createAllocation.mutationOptions({
      onSuccess: () => {
        toast.success('Offered to members. Every member with a cellar has been told.');
        setAllocation(emptyAllocation);
        setShowNewAllocation(false);
        void refetch();
      },
      onError,
    }),
  );

  const { mutate: closeAllocation } = useMutation(
    api.cellarSourcing.admin.closeAllocation.mutationOptions({
      onSuccess: () => void refetch(),
      onError,
    }),
  );

  const { mutate: allocate, isPending: isAllocating } = useMutation(
    api.cellarSourcing.admin.allocate.mutationOptions({
      onSuccess: () => {
        toast.success('Allocation sent to the member');
        void refetch();
      },
      onError,
    }),
  );

  const requests = data?.requests ?? [];
  const allocations = data?.allocations ?? [];

  const counts = {
    act: requests.filter((request) => TO_ACT.includes(request.status)).length,
    waiting: requests.filter((request) => request.status === 'offer_sent').length,
    buy: requests.filter((request) => request.status === 'accepted').length,
    all: requests.length,
  };

  const shown = requests.filter((request) => {
    if (filter === 'act') return TO_ACT.includes(request.status);
    if (filter === 'waiting') return request.status === 'offer_sent';
    if (filter === 'buy') return request.status === 'accepted';
    return true;
  });

  const openAllocations = allocations.filter((item) => item.status === 'open');
  const toShareOut = allocations.reduce(
    (sum, item) =>
      sum + item.interests.filter((interest) => interest.status === 'interested').length,
    0,
  );

  const startOffer = (request: (typeof requests)[number]) => {
    setOfferFor(request.id);
    setDraft({
      wineName: request.offerWineName ?? request.wineName,
      lwin18: request.offerLwin18 ?? '',
      vintage: request.offerVintage ? String(request.offerVintage) : '',
      caseConfig: String(request.offerCaseConfig ?? 6),
      cases: String(request.offerCases ?? Math.max(1, Math.round(request.bottles / 6))),
      price: request.offerPricePerBottleUsd ? String(request.offerPricePerBottleUsd) : '',
      holdAt: (request.offerHoldAt ?? request.holdAt) === 'uk' ? 'uk' : 'uae',
      validUntil: '',
      note: request.offerNote ?? '',
      fromStock: request.offerFromStock,
    });
  };

  const tiles = [
    { label: 'Waiting on us', value: counts.act, tone: 'border-amber-200 from-amber-50/70 dark:border-amber-900 dark:from-amber-500/10' },
    { label: 'Offers with members', value: counts.waiting, tone: 'border-slate-200 from-slate-50/70 dark:border-slate-700 dark:from-slate-500/10' },
    { label: 'Accepted · to buy', value: counts.buy, tone: 'border-emerald-200 from-emerald-50/70 dark:border-emerald-900 dark:from-emerald-500/10' },
    { label: 'Allocations open', value: openAllocations.length, tone: 'border-blue-200 from-blue-50/70 dark:border-blue-900 dark:from-blue-500/10' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-3">
        <p className="text-text-muted text-sm">Wines members asked us to find, and wines offered to members first</p>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isRefetching}
          className="border-border-muted text-text-primary inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold"
        >
          <Icon icon={IconRefresh} size="xs" /> Refresh
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className={`rounded-xl border bg-gradient-to-b to-transparent px-4 py-3 ${tile.tone}`}>
            <dt className="text-text-muted text-[10px] font-semibold uppercase tracking-[0.08em]">{tile.label}</dt>
            <dd className="text-text-primary m-0 mt-1 text-xl font-semibold tabular-nums">{tile.value}</dd>
          </div>
        ))}
      </dl>

      {/* Requests */}
      <section>
        <h2 className="text-text-primary mb-3 text-base font-semibold">Wine requests</h2>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(
            [
              { id: 'act', label: 'Waiting on us' },
              { id: 'waiting', label: 'Offer sent' },
              { id: 'buy', label: 'Accepted' },
              { id: 'all', label: 'All' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === item.id
                  ? 'bg-text-primary text-surface-primary'
                  : 'border-border-muted text-text-muted hover:text-text-primary border'
              }`}
            >
              {item.label}
              {counts[item.id] > 0 && <span className="ml-1.5 tabular-nums opacity-70">{counts[item.id]}</span>}
            </button>
          ))}
        </div>

        {isLoading && <p className="text-text-muted text-sm">Loading…</p>}
        {!isLoading && shown.length === 0 && (
          <p className="border-border-muted text-text-muted rounded-xl border px-6 py-10 text-center text-sm">
            Nothing here.
          </p>
        )}

        <ul className="space-y-2">
          {shown.map((request) => (
            <li key={request.id} className="border-border-muted bg-surface-primary rounded-xl border p-4 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-text-primary text-sm font-semibold">{request.wineName}</p>
                  <p className="text-text-muted mt-0.5 text-xs">
                    {[
                      request.memberName,
                      request.vintages,
                      `${request.bottles} btl`,
                      request.format,
                      request.budgetPerBottleUsd ? `up to ${money(request.budgetPerBottleUsd)}/btl` : null,
                      request.holdAt === 'uk' ? 'hold in UK' : 'hold in UAE',
                      request.lwin ? `LWIN ${request.lwin}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {request.notes && <p className="text-text-muted mt-1 text-xs italic">“{request.notes}”</p>}
                  <p className="text-text-muted mt-1 font-mono text-[11px]">
                    {request.requestNumber} · {formatDistanceToNowStrict(new Date(request.createdAt), { addSuffix: true })}
                  </p>
                  {request.offeredAt && (
                    <p className="text-text-muted mt-1 text-xs">
                      Offered: {request.offerCases} × {request.offerCaseConfig} at{' '}
                      {money(request.offerPricePerBottleUsd ?? 0)}/btl
                      {request.offerFromStock ? ' · from our UAE stock' : ''}
                    </p>
                  )}
                  {request.status === 'accepted' && (
                    <p className="mt-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                      {request.purchaseId ? 'Reserved from stock: see Cellar purchases.' : 'Team Tasks job opened to buy and invoice.'}
                    </p>
                  )}
                </div>
                <span className={`w-fit flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${PILL[request.status] ?? PILL.closed}`}>
                  {LABEL[request.status] ?? request.status}
                </span>
              </div>

              {['requested', 'searching', 'offer_sent', 'declined'].includes(request.status) && offerFor !== request.id && (
                <div className="border-border-muted mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                  <button
                    type="button"
                    onClick={() => startOffer(request)}
                    className="bg-text-primary text-surface-primary h-8 rounded-lg px-3 text-xs font-semibold"
                  >
                    {request.status === 'offer_sent' || request.status === 'declined' ? 'Send a new offer' : 'Send offer'}
                  </button>
                  {request.status === 'requested' && (
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => updateRequest({ requestId: request.id, status: 'searching' })}
                      className="border-border-muted text-text-primary h-8 rounded-lg border px-3 text-xs font-semibold"
                    >
                      Mark searching
                    </button>
                  )}
                  <Input
                    value={closeNote[request.id] ?? ''}
                    onChange={(event) => setCloseNote((value) => ({ ...value, [request.id]: event.target.value }))}
                    placeholder="Note to the member if closing (optional)"
                    className="h-8 min-w-[220px] flex-1 text-xs"
                  />
                  <ConfirmAction
                    title="Close this request?"
                    description={<p>The member is told we could not find it, with your note if you add one.</p>}
                    confirmLabel="Close request"
                    tone="danger"
                    onConfirm={() =>
                      updateRequest({
                        requestId: request.id,
                        status: 'closed',
                        staffNote: closeNote[request.id] || undefined,
                      })
                    }
                  >
                    <button type="button" className="text-text-muted h-8 px-2 text-xs font-semibold hover:text-red-700">
                      Close
                    </button>
                  </ConfirmAction>
                </div>
              )}

              {offerFor === request.id && draft && (
                <div className="border-border-muted mt-3 space-y-3 border-t pt-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <label className="col-span-2 block">
                      <span className={field}>Wine as offered</span>
                      <Input value={draft.wineName} onChange={(event) => setDraft({ ...draft, wineName: event.target.value })} />
                    </label>
                    <label className="block">
                      <span className={field}>Vintage</span>
                      <Input value={draft.vintage} onChange={(event) => setDraft({ ...draft, vintage: event.target.value })} />
                    </label>
                    <label className="block">
                      <span className={field}>LWIN-18</span>
                      <Input value={draft.lwin18} onChange={(event) => setDraft({ ...draft, lwin18: event.target.value })} placeholder="Needed for stock" />
                    </label>
                    <label className="block">
                      <span className={field}>Bottles per case</span>
                      <Input type="number" value={draft.caseConfig} onChange={(event) => setDraft({ ...draft, caseConfig: event.target.value })} />
                    </label>
                    <label className="block">
                      <span className={field}>Cases</span>
                      <Input type="number" value={draft.cases} onChange={(event) => setDraft({ ...draft, cases: event.target.value })} />
                    </label>
                    <label className="block">
                      <span className={field}>Price per bottle (USD)</span>
                      <Input type="number" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} />
                    </label>
                    <label className="block">
                      <span className={field}>Open until</span>
                      <Input type="date" value={draft.validUntil} onChange={(event) => setDraft({ ...draft, validUntil: event.target.value })} />
                    </label>
                    <label className="block">
                      <span className={field}>Held at</span>
                      <select
                        value={draft.holdAt}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            holdAt: event.target.value === 'uk' ? 'uk' : 'uae',
                            fromStock: event.target.value === 'uk' ? false : draft.fromStock,
                          })
                        }
                        className="border-border-muted bg-surface-primary h-10 w-full rounded-lg border px-2 text-sm"
                      >
                        <option value="uae">UAE warehouse</option>
                        <option value="uk">UK · LCB Burton</option>
                      </select>
                    </label>
                    <label className="col-span-2 flex items-center gap-2 self-end pb-2 text-xs sm:col-span-3">
                      <input
                        type="checkbox"
                        checked={draft.fromStock}
                        disabled={draft.holdAt === 'uk'}
                        onChange={(event) => setDraft({ ...draft, fromStock: event.target.checked })}
                      />
                      In our UAE stock and released for sale: accepting reserves it at once
                    </label>
                    <label className="col-span-2 block sm:col-span-4">
                      <span className={field}>Note to the member</span>
                      <Input value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="Provenance, condition, timing" />
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className="text-text-muted mr-auto text-xs">
                      Member sees{' '}
                      {money((toNumber(draft.cases) ?? 0) * (toNumber(draft.caseConfig) ?? 0) * (toNumber(draft.price) ?? 0))}{' '}
                      in total
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setOfferFor(null);
                        setDraft(null);
                      }}
                      className="text-text-muted h-9 px-3 text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <ConfirmAction
                      title="Send this offer?"
                      description={<p>The member is notified and can accept it straight away.</p>}
                      confirmLabel="Send offer"
                      onConfirm={() =>
                        sendOffer({
                          requestId: request.id,
                          wineName: draft.wineName,
                          lwin18: draft.lwin18 || undefined,
                          vintage: toNumber(draft.vintage),
                          caseConfig: toNumber(draft.caseConfig) ?? 1,
                          cases: toNumber(draft.cases) ?? 1,
                          pricePerBottleUsd: toNumber(draft.price) ?? 0,
                          holdAt: draft.holdAt,
                          validUntil: draft.validUntil ? new Date(`${draft.validUntil}T23:59:59`) : undefined,
                          note: draft.note || undefined,
                          fromStock: draft.fromStock,
                        })
                      }
                    >
                      <button
                        type="button"
                        disabled={isSending || !toNumber(draft.price)}
                        className="bg-text-primary text-surface-primary h-9 rounded-lg px-4 text-xs font-semibold disabled:opacity-50"
                      >
                        Send offer
                      </button>
                    </ConfirmAction>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Allocations */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-text-primary text-base font-semibold">
            Offered to members first
            {toShareOut > 0 && (
              <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                {toShareOut} to allocate
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={() => setShowNewAllocation((value) => !value)}
            className="bg-text-primary text-surface-primary inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold"
          >
            <Icon icon={IconPlus} size="xs" /> New allocation
          </button>
        </div>

        {showNewAllocation && (
          <div className="border-border-muted bg-surface-primary mb-4 space-y-3 rounded-xl border p-4 shadow-sm">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="col-span-2 block">
                <span className={field}>Wine</span>
                <Input value={allocation.wineName} onChange={(event) => setAllocation({ ...allocation, wineName: event.target.value })} />
              </label>
              <label className="block">
                <span className={field}>Producer</span>
                <Input value={allocation.producer} onChange={(event) => setAllocation({ ...allocation, producer: event.target.value })} />
              </label>
              <label className="block">
                <span className={field}>Vintage</span>
                <Input value={allocation.vintage} onChange={(event) => setAllocation({ ...allocation, vintage: event.target.value })} />
              </label>
              <label className="block">
                <span className={field}>Format</span>
                <Input value={allocation.format} onChange={(event) => setAllocation({ ...allocation, format: event.target.value })} />
              </label>
              <label className="block">
                <span className={field}>Bottles per case</span>
                <Input type="number" value={allocation.caseConfig} onChange={(event) => setAllocation({ ...allocation, caseConfig: event.target.value })} />
              </label>
              <label className="block">
                <span className={field}>Price per bottle (USD)</span>
                <Input type="number" value={allocation.price} onChange={(event) => setAllocation({ ...allocation, price: event.target.value })} />
              </label>
              <label className="block">
                <span className={field}>Cases available</span>
                <Input type="number" value={allocation.totalCases} onChange={(event) => setAllocation({ ...allocation, totalCases: event.target.value })} />
              </label>
              <label className="block">
                <span className={field}>Most per member</span>
                <Input type="number" value={allocation.maxCases} onChange={(event) => setAllocation({ ...allocation, maxCases: event.target.value })} placeholder="No limit" />
              </label>
              <label className="block">
                <span className={field}>Closes</span>
                <Input type="date" value={allocation.closesAt} onChange={(event) => setAllocation({ ...allocation, closesAt: event.target.value })} />
              </label>
              <label className="block">
                <span className={field}>Held at</span>
                <select
                  value={allocation.holdAt}
                  onChange={(event) =>
                    setAllocation({
                      ...allocation,
                      holdAt: event.target.value === 'uk' ? 'uk' : 'uae',
                      fromStock: event.target.value === 'uk' ? false : allocation.fromStock,
                    })
                  }
                  className="border-border-muted bg-surface-primary h-10 w-full rounded-lg border px-2 text-sm"
                >
                  <option value="uae">UAE warehouse</option>
                  <option value="uk">UK · LCB Burton</option>
                </select>
              </label>
              <label className="block">
                <span className={field}>LWIN-18</span>
                <Input value={allocation.lwin18} onChange={(event) => setAllocation({ ...allocation, lwin18: event.target.value })} placeholder="Needed for stock" />
              </label>
              <label className="col-span-2 block">
                <span className={field}>Delivery</span>
                <Input value={allocation.deliveryNote} onChange={(event) => setAllocation({ ...allocation, deliveryNote: event.target.value })} placeholder="e.g. En primeur, shipping spring 2028" />
              </label>
              <label className="col-span-2 flex items-center gap-2 self-end pb-2 text-xs">
                <input
                  type="checkbox"
                  checked={allocation.fromStock}
                  disabled={allocation.holdAt === 'uk'}
                  onChange={(event) => setAllocation({ ...allocation, fromStock: event.target.checked })}
                />
                In our UAE stock and released for sale: confirming reserves it at once
              </label>
              <label className="col-span-2 block sm:col-span-4">
                <span className={field}>Description for members</span>
                <Input value={allocation.description} onChange={(event) => setAllocation({ ...allocation, description: event.target.value })} />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowNewAllocation(false)} className="text-text-muted h-9 px-3 text-xs font-semibold">
                Cancel
              </button>
              <ConfirmAction
                title="Offer this to members?"
                description={<p>Every member with a cellar is notified straight away.</p>}
                confirmLabel="Offer to members"
                onConfirm={() =>
                  createAllocation({
                    wineName: allocation.wineName,
                    producer: allocation.producer || undefined,
                    lwin18: allocation.lwin18 || undefined,
                    vintage: toNumber(allocation.vintage),
                    format: allocation.format || undefined,
                    caseConfig: toNumber(allocation.caseConfig) ?? 6,
                    pricePerBottleUsd: toNumber(allocation.price) ?? 0,
                    totalCases: toNumber(allocation.totalCases) ?? 0,
                    maxCasesPerMember: toNumber(allocation.maxCases),
                    closesAt: allocation.closesAt ? new Date(`${allocation.closesAt}T23:59:59`) : undefined,
                    deliveryNote: allocation.deliveryNote || undefined,
                    description: allocation.description || undefined,
                    holdAt: allocation.holdAt,
                    fromStock: allocation.fromStock,
                  })
                }
              >
                <button
                  type="button"
                  disabled={isCreating || !allocation.wineName || !toNumber(allocation.price) || !toNumber(allocation.totalCases)}
                  className="bg-text-primary text-surface-primary h-9 rounded-lg px-4 text-xs font-semibold disabled:opacity-50"
                >
                  Offer to members
                </button>
              </ConfirmAction>
            </div>
          </div>
        )}

        {allocations.length === 0 && !showNewAllocation && (
          <p className="border-border-muted text-text-muted rounded-xl border px-6 py-10 text-center text-sm">
            No allocations yet.
          </p>
        )}

        <ul className="space-y-3">
          {allocations.map((item) => {
            const requested = item.interests
              .filter((interest) => ['interested', 'allocated', 'confirmed'].includes(interest.status))
              .reduce((sum, interest) => sum + interest.casesRequested, 0);
            const given = item.interests
              .filter((interest) => ['allocated', 'confirmed'].includes(interest.status))
              .reduce((sum, interest) => sum + (interest.casesAllocated ?? 0), 0);

            return (
              <li key={item.id} className="border-border-muted bg-surface-primary rounded-xl border p-4 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-text-primary text-sm font-semibold">
                      {item.wineName}
                      {item.vintage ? ` ${item.vintage}` : ''}
                    </p>
                    <p className="text-text-muted mt-0.5 text-xs">
                      {[
                        item.producer,
                        `${item.caseConfig} × ${item.format ?? '75cl'}`,
                        `${money(item.pricePerBottleUsd)}/btl`,
                        item.holdAt === 'uk' ? 'UK' : 'UAE',
                        item.fromStock ? 'from stock' : null,
                        item.closesAt ? `closes ${format(new Date(item.closesAt), 'd MMM')}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-text-muted text-xs tabular-nums">
                      Asked {requested} · given {given} of {item.totalCases} cases
                    </span>
                    {item.status === 'open' ? (
                      <ConfirmAction
                        title="Close this allocation?"
                        description={<p>Members can no longer ask for it. Shares already given still stand.</p>}
                        confirmLabel="Close"
                        tone="danger"
                        onConfirm={() => closeAllocation({ allocationId: item.id })}
                      >
                        <button type="button" className="border-border-muted h-8 rounded-lg border px-3 text-xs font-semibold">
                          Close
                        </button>
                      </ConfirmAction>
                    ) : (
                      <span className="bg-surface-muted text-text-muted rounded-full px-2.5 py-1 text-[11px] font-semibold">Closed</span>
                    )}
                  </div>
                </div>

                {item.interests.length > 0 && (
                  <ul className="divide-border-muted border-border-muted mt-3 divide-y border-t">
                    {item.interests.map((interest) => (
                      <li key={interest.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                        <span className="text-text-primary min-w-[160px] flex-1 font-medium">{interest.memberName}</span>
                        <span className="text-text-muted text-xs tabular-nums">asked {interest.casesRequested}</span>
                        {['interested', 'allocated'].includes(interest.status) ? (
                          <>
                            <Input
                              type="number"
                              min={0}
                              value={shares[interest.id] ?? String(interest.casesAllocated ?? interest.casesRequested)}
                              onChange={(event) => setShares((value) => ({ ...value, [interest.id]: event.target.value }))}
                              className="h-8 w-20 text-xs"
                            />
                            <button
                              type="button"
                              disabled={isAllocating}
                              onClick={() =>
                                allocate({
                                  interestId: interest.id,
                                  cases: toNumber(shares[interest.id] ?? String(interest.casesAllocated ?? interest.casesRequested)) ?? 0,
                                })
                              }
                              className="bg-text-primary text-surface-primary h-8 rounded-lg px-3 text-xs font-semibold disabled:opacity-50"
                            >
                              {interest.status === 'allocated' ? 'Update' : 'Allocate'}
                            </button>
                            {interest.status === 'allocated' && (
                              <span className="text-text-muted text-xs">awaiting member</span>
                            )}
                          </>
                        ) : (
                          <span className="bg-surface-muted text-text-muted rounded-full px-2 py-0.5 text-[11px] font-semibold">
                            {interest.status === 'confirmed'
                              ? `Confirmed · ${interest.casesAllocated} ${interest.purchaseId ? '· reserved' : '· to invoice'}`
                              : interest.status}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
};

export default SourcingAdmin;
