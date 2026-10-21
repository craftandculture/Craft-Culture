'use client';

import { IconDownload, IconPlaneDeparture, IconReceipt, IconTruck } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import { format } from 'date-fns';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';
import type { AppRouter } from '@/trpc-router';

import ukMoveTotal, { LCB_RECHARGE_MARKUP } from '../../utils/ukMoveTotal';
import ConfirmAction from '../ConfirmAction';

type Move = inferRouterOutputs<AppRouter>['cellar']['admin']['getUkMoves']['moves'][number];

type Filter = 'action' | 'member' | 'shipping' | 'closed' | 'all';

const money = (value: number) =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATES: Record<string, { label: string; tone: string }> = {
  submitted: { label: 'To quote', tone: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-900' },
  quoted: { label: 'With member', tone: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-900' },
  accepted: { label: 'To ship', tone: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-900' },
  shipping: { label: 'Shipping', tone: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-900' },
  arrived: { label: 'Arrived', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-900' },
  withdrawn: { label: 'Withdrawn', tone: 'bg-surface-muted text-text-muted ring-border-muted' },
  cancelled: { label: 'Closed', tone: 'bg-surface-muted text-text-muted ring-border-muted' },
};

const filterOf = (move: Move): Exclude<Filter, 'all'> => {
  switch (move.displayStatus) {
    case 'submitted':
    case 'accepted':
      return 'action';
    case 'quoted':
      return 'member';
    case 'shipping':
      return 'shipping';
    default:
      return 'closed';
  }
};

/** A CSV cell, quoted when it needs to be */
const cell = (value: string | number | null | undefined) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * Lines for LCB's Vision export order, one per LCB line
 *
 * Export (Non EC) under Goods Outwards → Enter Orders: the product code is the
 * dashed LWIN18, picked by rotation, consignee postcode "Export", and the move
 * number as Your Ref so the order and the request can be matched.
 */
const downloadVisionLines = (move: Move) => {
  const header = [
    'Your Ref',
    'Order Type',
    'Rotation',
    'Product Code',
    'Description',
    'Vintage',
    'Cases',
    'Singles',
    'Consignee',
    'Postcode',
  ];

  const rows = move.items.map((item) => [
    move.moveNumber,
    'Export (Non EC)',
    item.rotation,
    item.lwin18,
    item.name,
    item.vintage ?? 'NV',
    item.cases,
    item.singles,
    'Craft & Culture FZE, United Arab Emirates',
    'Export',
  ]);

  const csv = [header, ...rows].map((row) => row.map(cell).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const link = document.createElement('a');

  link.href = url;
  link.download = `${move.moveNumber}-lcb-export-order.csv`;
  link.click();
  /* Revoked on the next tick: revoking straight after click can cancel the download in Safari */
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

interface QuoteFormProps {
  move: Move;
  onDone: () => void;
}

/** Freight, LCB's charges and anything else; the member sees only the sum */
const QuoteForm = ({ move, onDone }: QuoteFormProps) => {
  const api = useTRPC();
  const [freight, setFreight] = useState(move.freightUsd?.toString() ?? '');
  const [lcb, setLcb] = useState(move.lcbChargesUsd?.toString() ?? '');

  /*
    LCB's own charges for this move, from the UK rate card at cost: handling
    each case out, and the export paperwork. Offered, not forced: an invoice
    from LCB that says otherwise wins.
  */
  const { data: ukRates } = useQuery(api.cellar.admin.getUkRates.queryOptions());
  const moveCases = move.items.reduce((sum, item) => sum + (item.cases ?? 0), 0);
  const fromCard =
    ukRates?.current && ukRates.gbpToUsd
      ? {
          gbp:
            Math.round(
              (moveCases * ukRates.current.handlingOutPerCaseGbp + ukRates.current.exportDocsPerMoveGbp) * 100,
            ) / 100,
          rate: ukRates.gbpToUsd,
        }
      : null;
  const [other, setOther] = useState(move.otherUsd?.toString() ?? '');
  const [otherLabel, setOtherLabel] = useState(move.otherLabel ?? '');
  const [notes, setNotes] = useState(move.adminNotes ?? '');

  const quote = useMutation(
    api.cellar.admin.quoteUkMove.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          result.status === 'cancelled' ? `${result.moveNumber} closed` : `Quote sent on ${result.moveNumber}`,
        );
        onDone();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const amount = (value: string) => (value.trim() === '' ? undefined : Number(value));
  const { lcbChargedUsd, totalUsd: total } = ukMoveTotal({
    freightUsd: amount(freight) ?? 0,
    lcbChargesUsd: amount(lcb) ?? 0,
    otherUsd: amount(other) ?? 0,
  });
  const isValid = amount(freight) !== undefined && !Number.isNaN(total) && (!amount(other) || otherLabel.trim());

  const field = 'border-border-muted bg-surface-primary h-9 w-full rounded-lg border px-2.5 text-sm tabular-nums';

  return (
    <div className="border-border-muted space-y-3 border-t bg-slate-50/50 px-4 py-3 dark:bg-slate-500/5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="text-text-muted text-[11px] font-semibold">
          Freight, Burton → UAE (USD)
          <input className={field} inputMode="decimal" value={freight} onChange={(event) => setFreight(event.target.value)} />
          <a
            href={`/platform/admin/logistics/requests/new?sourceType=uk_move&sourceId=${move.id}`}
            className="text-text-brand mt-0.5 block font-normal hover:underline"
          >
            Get forwarder quotes for this move
          </a>
        </label>
        <label className="text-text-muted text-[11px] font-semibold">
          LCB charges at cost (USD)
          <input className={field} inputMode="decimal" value={lcb} onChange={(event) => setLcb(event.target.value)} />
          {fromCard && fromCard.gbp > 0 && (
            <button
              type="button"
              onClick={() => setLcb((fromCard.gbp * fromCard.rate).toFixed(2))}
              className="text-text-brand mt-0.5 block text-left font-normal hover:underline"
            >
              From UK rates: {moveCases} cases out + paperwork = £{fromCard.gbp.toFixed(2)} ≈ $
              {(fromCard.gbp * fromCard.rate).toFixed(2)}. Use it
            </button>
          )}
          {lcbChargedUsd > 0 && (
            <span className="text-text-muted mt-0.5 block font-normal">
              {money(lcbChargedUsd)} charged, at cost + {LCB_RECHARGE_MARKUP * 100}%
            </span>
          )}
        </label>
        <label className="text-text-muted text-[11px] font-semibold">
          Other (USD)
          <input className={field} inputMode="decimal" value={other} onChange={(event) => setOther(event.target.value)} />
        </label>
        <label className="text-text-muted text-[11px] font-semibold">
          Other is for
          <input className={field} value={otherLabel} onChange={(event) => setOtherLabel(event.target.value)} />
        </label>
      </div>
      <label className="text-text-muted block text-[11px] font-semibold">
        Note to the member (optional; shown if you close it)
        <input className={field} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-text-primary text-sm font-semibold tabular-nums">
          Member sees {Number.isNaN(total) ? '—' : money(total)} all in
        </p>
        <div className="flex items-center gap-2">
          <ConfirmAction
            title={`Close ${move.moveNumber}?`}
            description={<p>The member is told the request is closed and the wine stays at LCB.</p>}
            confirmLabel="Close request"
            tone="danger"
            onConfirm={() => quote.mutate({ moveId: move.id, outcome: 'cancel', adminNotes: notes || undefined })}
          >
            <button type="button" disabled={quote.isPending} className="text-text-muted h-9 px-2 text-xs font-semibold hover:text-red-700">
              Close
            </button>
          </ConfirmAction>
          <ConfirmAction
            title={`Send ${money(total)} to ${move.partnerName ?? 'the member'}?`}
            description={<p>The member sees one all-in figure and can accept or withdraw.</p>}
            confirmLabel="Send quote"
            onConfirm={() =>
              quote.mutate({
                moveId: move.id,
                outcome: 'quote',
                freightUsd: amount(freight),
                lcbChargesUsd: amount(lcb),
                otherUsd: amount(other),
                otherLabel: otherLabel.trim() || undefined,
                adminNotes: notes.trim() || undefined,
              })
            }
          >
            <button
              type="button"
              disabled={!isValid || quote.isPending}
              className="bg-text-primary text-surface-primary h-9 rounded-lg px-3.5 text-xs font-semibold disabled:opacity-40"
            >
              {move.displayStatus === 'quoted' ? 'Revise quote' : 'Send quote'}
            </button>
          </ConfirmAction>
        </div>
      </div>
    </div>
  );
};

interface ShipFormProps {
  move: Move;
  shipments: inferRouterOutputs<AppRouter>['cellar']['admin']['getUkMoves']['shipments'];
  onDone: () => void;
}

/** Create the inbound shipment for an accepted move, or put it on one already planned */
const ShipForm = ({ move, shipments, onDone }: ShipFormProps) => {
  const api = useTRPC();
  const [transportMode, setTransportMode] = useState<'sea_fcl' | 'sea_lcl' | 'air' | 'road'>('sea_lcl');
  const [linkTo, setLinkTo] = useState('');

  const ship = useMutation(
    api.cellar.admin.shipUkMove.mutationOptions({
      onSuccess: () => {
        toast.success(`${move.moveNumber} is on its shipment. The member has been told.`);
        onDone();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const select = 'border-border-muted bg-surface-primary h-9 rounded-lg border px-2 text-xs font-semibold';

  /*
    An accepted move can still be called off before anything ships: the
    member changed their mind, or LCB cannot release the lines. The member can
    no longer withdraw at this point, so staff close it.
  */
  const close = useMutation(
    api.cellar.admin.quoteUkMove.mutationOptions({
      onSuccess: () => {
        toast.success(`${move.moveNumber} closed. The member has been told.`);
        onDone();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  return (
    <div className="border-border-muted space-y-2.5 border-t bg-slate-50/50 px-4 py-3 dark:bg-slate-500/5">
      <p className="text-text-muted text-xs leading-5">
        1. Download the lines and place an <strong>Export (Non EC)</strong> order in Vision with Your Ref{' '}
        <span className="font-mono">{move.moveNumber}</span>. 2. Create the inbound shipment, or add this move to one
        already planned. Receiving it puts the wine in the member&apos;s UAE cellar.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => downloadVisionLines(move)}
          className="border-border-muted text-text-primary inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold"
        >
          <IconDownload size={14} />
          Vision order lines
        </button>
        <span className="text-text-muted text-xs">then</span>
        <select value={transportMode} onChange={(event) => setTransportMode(event.target.value as typeof transportMode)} className={select}>
          <option value="sea_lcl">Sea, shared container</option>
          <option value="sea_fcl">Sea, full container</option>
          <option value="air">Air</option>
          <option value="road">Road</option>
        </select>
        <ConfirmAction
          title="Create the inbound shipment?"
          description={<p>A draft inbound shipment owned by the member, not for sale, with one line per LCB line.</p>}
          confirmLabel="Create shipment"
          onConfirm={() => ship.mutate({ mode: 'create', moveId: move.id, transportMode })}
        >
          <button
            type="button"
            disabled={ship.isPending}
            className="bg-text-primary text-surface-primary inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold disabled:opacity-50"
          >
            <IconPlaneDeparture size={14} />
            Create shipment
          </button>
        </ConfirmAction>
        {shipments.length > 0 && (
          <>
            <span className="text-text-muted text-xs">or</span>
            <select value={linkTo} onChange={(event) => setLinkTo(event.target.value)} className={select}>
              <option value="">Add to a planned shipment…</option>
              {shipments.map((shipment) => (
                <option key={shipment.id} value={shipment.id}>
                  {shipment.shipmentNumber}
                  {shipment.name ? ` · ${shipment.name}` : ''} ({shipment.status.replace(/_/g, ' ')})
                </option>
              ))}
            </select>
            {linkTo && (
              <ConfirmAction
                title="Add this move to that shipment?"
                description={
                  <p>
                    The move&apos;s lines are added to that shipment in the member&apos;s name, so receiving puts the
                    wine in their cellar. Do not add the same wine to it by hand.
                  </p>
                }
                confirmLabel="Add to shipment"
                onConfirm={() => ship.mutate({ mode: 'link', moveId: move.id, shipmentId: linkTo })}
              >
                <button type="button" disabled={ship.isPending} className="border-border-muted h-9 rounded-lg border px-3 text-xs font-semibold">
                  Add
                </button>
              </ConfirmAction>
            )}
          </>
        )}
        <ConfirmAction
          title={`Close ${move.moveNumber}?`}
          description={
            <p>
              Only before the Vision export order is placed. The member is told the request is closed and the wine
              stays at LCB.
            </p>
          }
          confirmLabel="Close request"
          tone="danger"
          onConfirm={() => close.mutate({ moveId: move.id, outcome: 'cancel' })}
        >
          <button
            type="button"
            disabled={close.isPending}
            className="text-text-muted ml-auto h-9 px-2 text-xs font-semibold hover:text-red-700"
          >
            Close
          </button>
        </ConfirmAction>
      </div>
    </div>
  );
};

/**
 * Members' requests to bring wine from LCB Burton to the UAE
 *
 * Exception-first: the default view is what needs the team — moves to quote
 * and accepted moves to put on a shipment. Everything else is a filter away.
 */
const UkMovesList = () => {
  const api = useTRPC();
  const [filter, setFilter] = useState<Filter | null>(null);
  const { data, refetch } = useQuery(api.cellar.admin.getUkMoves.queryOptions());

  const moves = data?.moves ?? [];
  const counts = {
    action: moves.filter((move) => filterOf(move) === 'action').length,
    member: moves.filter((move) => filterOf(move) === 'member').length,
    shipping: moves.filter((move) => filterOf(move) === 'shipping').length,
    closed: moves.filter((move) => filterOf(move) === 'closed').length,
    all: moves.length,
  };

  const active: Filter = filter ?? (counts.action > 0 ? 'action' : 'all');
  const shown = moves.filter((move) => active === 'all' || filterOf(move) === active);
  const onDone = () => void refetch();

  const tiles = [
    {
      label: 'To quote',
      value: moves.filter((move) => move.displayStatus === 'submitted').length,
      icon: IconReceipt,
    },
    {
      label: 'To ship',
      value: moves.filter((move) => move.displayStatus === 'accepted').length,
      icon: IconPlaneDeparture,
    },
    {
      label: 'On the way',
      value: counts.shipping,
      icon: IconTruck,
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <p className="text-text-primary text-sm font-semibold">UK to UAE moves</p>
        <p className="text-text-muted text-xs">
          Members ask to bring wine from LCB Burton to the UAE. Quote it, then once accepted place the Vision export
          order and create the shipment.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className={`rounded-xl border bg-gradient-to-b to-transparent px-3 py-2.5 text-center shadow-sm ${
              tile.value > 0 && tile.label !== 'On the way'
                ? 'border-red-100 from-red-50/50 dark:border-red-900/50 dark:from-red-500/10'
                : 'border-slate-200 from-slate-50/60 dark:border-slate-700 dark:from-slate-500/10'
            }`}
          >
            <span className="mx-auto mb-1 flex size-6 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-500/20">
              <tile.icon size={13} />
            </span>
            <span className="text-text-primary block text-lg font-bold leading-tight tabular-nums">{tile.value}</span>
            <span className="text-text-muted block text-[11px]">{tile.label}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['action', 'Needs us'],
            ['member', 'With member'],
            ['shipping', 'Shipping'],
            ['closed', 'Done and closed'],
            ['all', 'All'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              active === key ? 'bg-text-primary text-surface-primary' : 'bg-surface-muted text-text-muted hover:text-text-primary'
            }`}
          >
            {label} <span className="tabular-nums opacity-70">{counts[key]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="border-border-muted text-text-muted rounded-xl border px-4 py-8 text-center text-sm">
          {moves.length === 0 ? 'No member has asked to move UK wine yet.' : 'Nothing here.'}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {shown.map((move) => {
            const state = STATES[move.displayStatus] ?? STATES.cancelled!;
            const bottles = move.items.reduce((sum, item) => sum + item.totalBottles, 0);

            return (
              <li key={move.id} className="border-border-muted bg-surface-primary overflow-hidden rounded-xl border shadow-sm">
                <div className="border-border-muted flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
                  <p className="text-text-muted text-xs">
                    <span className="text-text-primary text-sm font-semibold">{move.partnerName ?? 'Member'}</span>
                    {' · '}
                    <span className="font-mono">{move.moveNumber}</span> · {bottles} {bottles === 1 ? 'bottle' : 'bottles'}{' '}
                    · asked {format(new Date(move.createdAt), 'd MMM yyyy')}
                    {typeof move.totalUsd === 'number' ? ` · quoted ${money(move.totalUsd)}` : ''}
                  </p>
                  <span className="flex items-center gap-2">
                    {move.shipmentId && (
                      <Link
                        href={`/platform/admin/logistics/shipments/${move.shipmentId}`}
                        className="text-text-primary font-mono text-xs font-semibold underline-offset-2 hover:underline"
                      >
                        {move.shipmentNumber}
                      </Link>
                    )}
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${state.tone}`}>
                      {state.label}
                    </span>
                  </span>
                </div>

                <ul className="divide-border-muted divide-y">
                  {move.items.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2 text-sm">
                      <span className="min-w-0">
                        {item.name}
                        <span className="text-text-muted"> · {item.vintage ?? 'NV'}</span>
                        <span className="text-text-muted/70 ml-2 font-mono text-[11px]">
                          {item.rotation} · {item.lwin18}
                        </span>
                      </span>
                      <span className="text-text-muted text-xs tabular-nums">
                        {item.cases > 0 ? `${item.cases} × ${item.bottlesPerCase ?? '?'}` : ''}
                        {item.cases > 0 && item.singles > 0 ? ' + ' : ''}
                        {item.singles > 0 ? `${item.singles} single${item.singles === 1 ? '' : 's'}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>

                {move.memberNotes && (
                  <p className="border-border-muted text-text-muted border-t px-4 py-2 text-xs">
                    Member: &ldquo;{move.memberNotes}&rdquo;
                  </p>
                )}

                {(move.displayStatus === 'submitted' || move.displayStatus === 'quoted') && (
                  <QuoteForm move={move} onDone={onDone} />
                )}
                {move.displayStatus === 'accepted' && (
                  <ShipForm move={move} shipments={data?.shipments ?? []} onDone={onDone} />
                )}
                {move.displayStatus === 'shipping' && (
                  <div className="border-border-muted flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5">
                    <p className="text-text-muted text-xs">
                      Shows as arrived once the shipment is received into the warehouse.
                    </p>
                    <button
                      type="button"
                      onClick={() => downloadVisionLines(move)}
                      className="text-text-muted hover:text-text-primary inline-flex items-center gap-1 text-xs font-semibold"
                    >
                      <IconDownload size={13} />
                      Vision order lines
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default UkMovesList;
