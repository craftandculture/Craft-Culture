'use client';

import { IconBuildingWarehouse, IconPlaneDeparture } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import { differenceInDays, format } from 'date-fns';
import { useState } from 'react';
import { toast } from 'sonner';

import ContactLinks from '@/app/_onboarding/components/ContactLinks';
import useActivationGate from '@/app/_onboarding/hooks/useActivationGate';
import useTRPC from '@/lib/trpc/browser';
import type { AppRouter } from '@/trpc-router';

import ConfirmAction from './ConfirmAction';
import bottleName from '../utils/bottleName';

type UkHoldings = inferRouterOutputs<AppRouter>['cellar']['member']['getUkHoldings'];
type UkMove = inferRouterOutputs<AppRouter>['cellar']['member']['getUkMoves']['moves'][number];

export interface UkHoldingsPanelProps {
  data: UkHoldings;
  /** Formats a USD amount in the currency the cellar is being read in */
  formatValue?: (usd: number) => string;
}

interface QuantityLine {
  bottleSizeLitres: number | null;
  bottlesPerCase: number | null;
  cases: number;
  singles: number;
  totalBottles: number;
}

/** "4 cases of 6", "3 bottles", "1 magnum", as a collector would say it */
const quantityOf = (holding: QuantityLine) => {
  const size = holding.bottleSizeLitres ? bottleName(`${Math.round(holding.bottleSizeLitres * 100)}cl`) : null;
  const isNamed = size !== null && !/\d/.test(size);
  const unit = (count: number) =>
    isNamed && size ? `${count} ${size.toLowerCase()}${count === 1 ? '' : 's'}` : `${count} ${count === 1 ? 'bottle' : 'bottles'}`;

  const parts: string[] = [];

  if (holding.cases > 0 && holding.bottlesPerCase) {
    parts.push(`${holding.cases} ${holding.cases === 1 ? 'case' : 'cases'} of ${holding.bottlesPerCase}`);
  }

  if (holding.singles > 0 || parts.length === 0) {
    parts.push(unit(holding.cases > 0 ? holding.singles : holding.totalBottles));
  }

  return parts.join(' and ');
};

const money = (value: number) =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const lineKey = (item: { rotation: string; line: number }) => `${item.rotation}:${item.line}`;

/** Each step, as the member would want it explained */
const MOVE_STATES: Record<string, { label: string; tone: string }> = {
  submitted: { label: 'Being priced', tone: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-900' },
  quoted: { label: 'Price ready', tone: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-900' },
  accepted: { label: 'Being arranged', tone: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-900' },
  shipping: { label: 'On its way to the UAE', tone: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-900' },
  arrived: { label: 'In your UAE cellar', tone: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/20 dark:text-slate-200 dark:ring-slate-700' },
  cancelled: { label: 'Closed', tone: 'bg-surface-muted text-text-muted ring-border-muted' },
};

const detailOf = (move: UkMove) => {
  switch (move.status) {
    case 'submitted':
      return 'We are arranging the freight and will send you one all-in price. Nothing moves until you accept it.';
    case 'quoted':
      return 'All in: collection from London City Bond, freight, and receipt into our bonded warehouse in the UAE. Duty and VAT stay suspended.';
    case 'accepted':
      return 'We are booking the collection from London City Bond and will let you know when it leaves.';
    case 'shipping':
      return move.eta
        ? `Expected at our UAE warehouse around ${format(new Date(move.eta), 'd MMMM')}. It will appear in your cellar once received.`
        : 'It will appear in your cellar once received at our UAE warehouse.';
    case 'arrived':
      return move.arrivedAt
        ? `Received ${format(new Date(move.arrivedAt), 'd MMMM yyyy')} and now held in your cellar in the UAE.`
        : 'Received and now held in your cellar in the UAE.';
    default:
      return move.adminNotes || 'Your wine remains at London City Bond.';
  }
};

/** Finished moves stay on view for a month, then leave the panel */
const isRecent = (move: UkMove) => {
  if (move.status === 'withdrawn') return false;
  if (move.status !== 'arrived' && move.status !== 'cancelled') return true;

  const since = move.arrivedAt ?? move.shippedAt ?? move.createdAt;

  return differenceInDays(new Date(), new Date(since)) <= 30;
};

/**
 * The member's wine at C&C's UK bond, in the same collection as the rest
 *
 * Read from LCB's own stock report, so it is exactly what our account at
 * Burton holds for them. Nothing is priced on the holdings themselves; a
 * member chooses wine to bring to the UAE, we send one all-in price, and it
 * moves only once they accept it.
 */
const UkHoldingsPanel = ({ data, formatValue }: UkHoldingsPanelProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const { catchActivation, activationSheet } = useActivationGate();
  const [isChoosing, setIsChoosing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  /* Prices follow the currency the cellar is being read in, like the rest of the page */
  const price = formatValue ?? money;

  const { data: moveData } = useQuery(api.cellar.member.getUkMoves.queryOptions());
  const moves = moveData?.moves ?? [];

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: api.cellar.member.getUkMoves.queryKey() });
    void queryClient.invalidateQueries({ queryKey: api.cellar.member.getUkHoldings.queryKey() });
  };

  const onError = (error: { message: string }) => catchActivation(error, 'other') || toast.error(error.message);

  const requestMove = useMutation(
    api.cellar.member.requestUkMove.mutationOptions({
      onSuccess: (move) => {
        toast.success(`${move.moveNumber} is with us. We will send you the price shortly.`);
        setIsChoosing(false);
        setSelected(new Set());
        setNote('');
        refresh();
      },
      onError,
    }),
  );

  const acceptMove = useMutation(
    api.cellar.member.acceptUkMove.mutationOptions({
      onSuccess: (move) => {
        toast.success(`Thank you. We are arranging ${move.moveNumber}.`);
        refresh();
      },
      onError,
    }),
  );

  const withdrawMove = useMutation(
    api.cellar.member.withdrawUkMove.mutationOptions({
      onSuccess: (move) => {
        toast.success(`${move.moveNumber} withdrawn. Your wine remains at London City Bond.`);
        refresh();
      },
      onError,
    }),
  );

  /* Lines already on a move: arrived ones leave the list, the rest are marked */
  const moveByLine = new Map<string, UkMove>();

  for (const move of moves) {
    if (!['submitted', 'quoted', 'accepted', 'shipping', 'arrived'].includes(move.status)) continue;
    for (const item of move.items) moveByLine.set(lineKey(item), move);
  }

  const holdings = data.holdings.filter((holding) => moveByLine.get(lineKey(holding))?.status !== 'arrived');
  const shownMoves = moves.filter(isRecent);

  if (holdings.length === 0 && shownMoves.length === 0) return null;

  const bottles = holdings.reduce((sum, holding) => sum + holding.totalBottles, 0);
  const movable = holdings.filter((holding) => !moveByLine.has(lineKey(holding)));
  const chosen = holdings.filter((holding) => selected.has(holding.id));
  const chosenBottles = chosen.reduce((sum, holding) => sum + holding.totalBottles, 0);

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="border-border-muted bg-surface-primary mt-8 overflow-hidden rounded-xl border shadow-sm">
      {activationSheet}
      <header className="border-border-muted flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-500/20">
            <IconBuildingWarehouse size={15} />
          </span>
          <div>
            <p className="text-text-primary text-sm font-semibold">United Kingdom · London City Bond, Burton</p>
            <p className="text-text-muted text-xs">
              Held in bond for you by C&amp;C · {holdings.length}{' '}
              {holdings.length === 1 ? 'wine' : 'wines'}, {bottles} {bottles === 1 ? 'bottle' : 'bottles'}
              {data.reportedAt ? ` · updated ${format(new Date(data.reportedAt), 'd MMM yyyy')}` : ''}
            </p>
          </div>
        </div>
        {movable.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setIsChoosing((value) => !value);
              setSelected(new Set());
            }}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors ${
              isChoosing
                ? 'border-border-muted text-text-muted hover:text-text-primary border'
                : 'bg-text-primary text-surface-primary'
            }`}
          >
            {!isChoosing && <IconPlaneDeparture size={14} />}
            {isChoosing ? 'Cancel' : 'Bring to the UAE'}
          </button>
        )}
      </header>

      {shownMoves.length > 0 && (
        <ul className="divide-border-muted border-border-muted divide-y border-b bg-slate-50/50 dark:bg-slate-500/5">
          {shownMoves.map((move) => {
            const state = MOVE_STATES[move.status] ?? MOVE_STATES.cancelled!;
            const moveBottles = move.items.reduce((sum, item) => sum + item.totalBottles, 0);

            return (
              <li key={move.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-text-primary text-sm font-semibold">
                      Bringing {move.items.length === 1 ? move.items[0]!.name : `${move.items.length} wines`} to the UAE
                    </p>
                    <p className="text-text-muted mt-0.5 text-xs">
                      {moveBottles} {moveBottles === 1 ? 'bottle' : 'bottles'}
                      <span className="text-text-muted/70"> · {move.moveNumber}</span>
                    </p>
                  </div>
                  <span className={`w-fit flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${state.tone}`}>
                    {state.label}
                  </span>
                </div>

                {move.status === 'quoted' && typeof move.totalUsd === 'number' && (
                  <p className="text-text-primary mt-2 text-lg font-bold tabular-nums">{price(move.totalUsd)}</p>
                )}
                <p className="text-text-muted mt-1 max-w-[70ch] text-xs leading-5">{detailOf(move)}</p>

                {(move.status === 'quoted' || move.status === 'submitted') && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    {move.status === 'quoted' && typeof move.totalUsd === 'number' && (
                      <ConfirmAction
                        title="Accept this price?"
                        description={
                          <p>
                            We will collect your wine from London City Bond and bring it to our bonded warehouse in the
                            UAE for {price(move.totalUsd)}, all in. It stays under bond throughout, so no duty or VAT
                            is due until you ask for a delivery.
                          </p>
                        }
                        confirmLabel="Accept and arrange"
                        onConfirm={() => acceptMove.mutate({ moveId: move.id, totalUsd: move.totalUsd! })}
                      >
                        <button
                          type="button"
                          disabled={acceptMove.isPending}
                          className="bg-text-primary text-surface-primary h-9 rounded-lg px-3.5 text-xs font-semibold disabled:opacity-50"
                        >
                          Accept and arrange
                        </button>
                      </ConfirmAction>
                    )}
                    <ConfirmAction
                      title="Withdraw this request?"
                      description={<p>Your wine remains at London City Bond. You can ask again at any time.</p>}
                      confirmLabel="Withdraw request"
                      tone="danger"
                      onConfirm={() => withdrawMove.mutate({ moveId: move.id })}
                    >
                      <button
                        type="button"
                        disabled={withdrawMove.isPending}
                        className="text-text-muted h-9 rounded-lg px-2 text-xs font-medium transition-colors hover:text-red-700 disabled:opacity-50"
                      >
                        Withdraw
                      </button>
                    </ConfirmAction>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {isChoosing && (
        <p className="border-border-muted text-text-muted border-b bg-emerald-50/40 px-4 py-2 text-xs dark:bg-emerald-500/5">
          Choose the wines to bring to your cellar in the UAE. Each wine moves in full, as London City Bond holds it.
        </p>
      )}

      <ul className="divide-border-muted divide-y">
        {holdings.map((holding) => {
          const move = moveByLine.get(lineKey(holding));
          const canChoose = isChoosing && !move;
          const isSelected = selected.has(holding.id);

          const body = (
            <>
              <span className="flex min-w-0 items-start gap-2.5">
                {canChoose && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(holding.id)}
                    className="mt-0.5 size-4 flex-shrink-0 accent-emerald-700"
                    aria-label={`Bring ${holding.name} to the UAE`}
                  />
                )}
                <span className="min-w-0 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  {holding.name}
                  <span className="text-text-muted font-normal"> · {holding.vintage ?? 'NV'}</span>
                </span>
              </span>
              <span className="text-text-muted flex flex-shrink-0 flex-wrap items-center gap-2 text-xs tabular-nums">
                {quantityOf(holding)}
                {holding.receivedAt ? ` · since ${format(new Date(holding.receivedAt), 'MMM yyyy')}` : ''}
                {/* Our list price where we list the same wine: a guide, as on the cellar above */}
                {formatValue && holding.indicativePerBottle
                  ? ` · about ${formatValue(holding.indicativePerBottle)} a bottle`
                  : ''}
                {move && (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                    {move.status === 'shipping' ? 'On its way to the UAE' : 'Moving to the UAE'}
                  </span>
                )}
              </span>
            </>
          );

          return canChoose ? (
            <li key={holding.id}>
              <label
                className={`flex cursor-pointer flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4 ${
                  isSelected ? 'bg-emerald-50/50 dark:bg-emerald-500/5' : 'hover:bg-fill-muted/40'
                }`}
              >
                {body}
              </label>
            </li>
          ) : (
            <li key={holding.id} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              {body}
            </li>
          );
        })}
      </ul>

      {isChoosing && (
        <div className="border-border-muted flex flex-col gap-2 border-t bg-emerald-50/40 px-4 py-3 sm:flex-row sm:items-center dark:bg-emerald-500/5">
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={1000}
            placeholder="Anything we should know (optional)"
            className="border-border-muted bg-surface-primary h-10 flex-1 rounded-lg border px-3 text-sm"
          />
          <ConfirmAction
            title="Ask us to bring this wine to the UAE?"
            description={
              <p>
                We will price the collection and freight for {chosen.length} {chosen.length === 1 ? 'wine' : 'wines'} (
                {chosenBottles} {chosenBottles === 1 ? 'bottle' : 'bottles'}) and send you one all-in figure. Nothing
                moves until you accept it.
              </p>
            }
            confirmLabel="Request a price"
            onConfirm={() =>
              requestMove.mutate({ holdingIds: [...selected], memberNotes: note.trim() || undefined })
            }
          >
            <button
              type="button"
              disabled={chosen.length === 0 || requestMove.isPending}
              className="bg-text-primary text-surface-primary h-10 rounded-lg px-4 text-sm font-semibold disabled:opacity-40"
            >
              {chosen.length === 0
                ? 'Choose wines above'
                : `Request a price for ${chosen.length} ${chosen.length === 1 ? 'wine' : 'wines'}`}
            </button>
          </ConfirmAction>
        </div>
      )}

      <footer className="border-border-muted bg-surface-muted/40 space-y-2 border-t px-4 py-3">
        <p className="text-text-muted text-xs leading-5">
          Your UK wine stays under bond, duty and VAT suspended. To bring any of it to your cellar in the UAE, choose
          Bring to the UAE and we will send you the price first.
        </p>
        <ContactLinks />
      </footer>
    </section>
  );
};

export default UkHoldingsPanel;
