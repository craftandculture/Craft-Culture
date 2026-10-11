'use client';

import { IconAlertTriangle, IconArrowBackUp, IconArrowRight, IconCheck, IconChevronDown, IconRefresh, IconX } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import { useMemo, useState } from 'react';

import useTRPC, { useTRPCClient } from '@/lib/trpc/browser';
import type { AppRouter } from '@/trpc-router';

import BatchChanges from './BatchChanges';

type Plan = inferRouterOutputs<AppRouter>['zohoCodes']['plan'];
type Action = Plan['actions'][number];
type Kind = Action['kind'];
type Result = { ok: boolean; message: string };

const card = 'rounded-xl border border-border-muted bg-surface-primary shadow-sm';

const TABS: { kind: Kind; label: string; help: string; preselect: boolean }[] = [
  {
    kind: 'retire',
    label: 'Old codes',
    help: 'Every item whose SKU is not a dashed LWIN — compact codes, brand codes, blanks. Each is renamed "… (old)" and made inactive. Past invoices keep pointing at it; it just cannot be picked for new orders. Anything sold in the last 90 days that Stock Explorer would not replace is held back automatically — nothing needs unticking.',
    preselect: true,
  },
  {
    kind: 'create',
    label: 'New items',
    help: 'Every Stock Explorer line with no active Zoho item under its code, created from the Stock Explorer record — name, vintage, pack and producer — after the old item has given up its name.',
    preselect: true,
  },
  {
    kind: 'retire_duplicate',
    label: 'Duplicates',
    help: 'Two active items under one dashed code. The one on an open order (else the newest) is kept; the others are retired.',
    preselect: true,
  },
  {
    kind: 'retire_not_held',
    label: 'Not held',
    help: 'Dashed codes Stock Explorer does not hold in any pack, with nothing inbound. Nothing here is selected until you choose; receiving the wine again creates a fresh item.',
    preselect: false,
  },
  {
    kind: 'review',
    label: 'Review',
    help: 'Dashed items whose name gives a different vintage from their code, so one of the two is wrong. Check against the Stock Explorer name and fix in Zoho by hand.',
    preselect: false,
  },
];

const ORDER: Record<Kind, number> = { retire: 0, retire_duplicate: 1, retire_not_held: 2, create: 3, review: 9 };

/**
 * Zoho code cleanup
 *
 * Reads every Zoho item, matches it to Stock Explorer and proposes one change
 * per item. Changes are chosen per tab, written ten at a time with each item
 * re-checked live, and every batch can be undone from the history.
 */
const ZohoCodesClient = () => {
  const api = useTRPC();
  const client = useTRPCClient();
  const queryClient = useQueryClient();

  const plan = useQuery({ ...api.zohoCodes.plan.queryOptions(), staleTime: Infinity, refetchOnWindowFocus: false });
  const batches = useQuery(api.zohoCodes.batches.queryOptions());

  const [tab, setTab] = useState<Kind>('retire');
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [results, setResults] = useState<Map<string, Result>>(new Map());
  const [running, setRunning] = useState<{ done: number; total: number } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [undoing, setUndoing] = useState<string | null>(null);
  const [openBatch, setOpenBatch] = useState<string | null>(null);

  const actions = useMemo(() => plan.data?.actions ?? [], [plan.data]);
  const ready = (a: Action) => !a.blocked && a.kind !== 'review' && !results.get(a.id)?.ok;

  // Selection defaults to every ready action in the preselected tabs
  const selected = useMemo(() => {
    if (picked) return picked;
    const pre = new Set(TABS.filter((t) => t.preselect).map((t) => t.kind));
    return new Set(actions.filter((a) => pre.has(a.kind) && !a.blocked && a.kind !== 'review').map((a) => a.id));
  }, [picked, actions]);

  const toggle = (ids: string[], on: boolean) => {
    const next = new Set(selected);
    for (const id of ids) {
      if (on) next.add(id);
      else next.delete(id);
    }
    setPicked(next);
  };

  const shown = actions.filter((a) => a.kind === tab);
  const shownReady = shown.filter(ready);
  const chosen = actions.filter((a) => selected.has(a.id) && ready(a));
  const chosenIds = new Set(chosen.map((a) => a.id));
  // A new item can take its name only once the old item has given it up
  const queue = chosen
    .filter((a) => !a.dependsOn || chosenIds.has(a.dependsOn) || results.get(a.dependsOn)?.ok)
    .sort((a, b) => ORDER[a.kind] - ORDER[b.kind]);

  // A pilot that shows both halves: old items retired AND their replacements created
  const pairs = queue.filter((a) => a.kind === 'create' && a.dependsOn).slice(0, 5);
  const pairedRetires = new Set(pairs.map((a) => a.dependsOn));
  const pilot = pairs.length
    ? [...queue.filter((a) => pairedRetires.has(a.id)), ...pairs]
    : queue.slice(0, 10);

  const run = async (list: Action[]) => {
    setConfirming(false);
    const batchId = crypto.randomUUID();
    setRunning({ done: 0, total: list.length });
    const next = new Map(results);
    for (let i = 0; i < list.length; i += 10) {
      const slice = list.slice(i, i + 10);
      try {
        const res = await client.zohoCodes.applyChanges.mutate({
          batchId,
          actions: slice.map((a) =>
            a.kind === 'create'
              ? {
                  id: a.id,
                  kind: 'create' as const,
                  name: a.name,
                  sku: a.sku,
                  producer: a.create?.producer ?? null,
                  bottlesPerCase: a.create?.bottlesPerCase ?? 1,
                  bottleSizeMl: a.create?.bottleSizeMl ?? 750,
                  reason: a.reason,
                }
              : {
                  id: a.id,
                  kind: a.kind as 'retire' | 'retire_duplicate' | 'retire_not_held',
                  itemId: a.itemId ?? '',
                  expectSku: a.sku,
                  expectName: a.name,
                  toName: a.toName ?? '',
                  toSku: a.toSku,
                  reason: a.reason,
                },
          ),
        });
        for (const r of res.results) next.set(r.id, r);
      } catch (error) {
        for (const a of slice) next.set(a.id, { ok: false, message: error instanceof Error ? error.message : 'Request failed' });
      }
      setResults(new Map(next));
      setRunning({ done: Math.min(i + 10, list.length), total: list.length });
    }
    setRunning(null);
    setOpenBatch(batchId);
    void queryClient.invalidateQueries({ queryKey: api.zohoCodes.batches.queryKey() });
  };

  const undo = async (batchId: string) => {
    setUndoing(batchId);
    try {
      for (let guard = 0; guard < 40; guard++) {
        const res = await client.zohoCodes.undo.mutate({ batchId });
        if (res.done) break;
      }
    } finally {
      setUndoing(null);
      setResults(new Map());
      void queryClient.invalidateQueries({ queryKey: api.zohoCodes.batches.queryKey() });
      void plan.refetch();
    }
  };

  const counts = (kind: Kind) => {
    const list = actions.filter((a) => a.kind === kind);
    return { all: list.length, blocked: list.filter((a) => a.blocked).length };
  };
  const current = TABS.find((t) => t.kind === tab)!;
  const doneCount = [...results.values()].filter((r) => r.ok).length;
  const skippedCount = [...results.values()].filter((r) => !r.ok).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Zoho codes</h1>
          <p className="max-w-2xl text-sm text-text-muted">
            A clean start: every item without a dashed LWIN is retired, and every Stock Explorer line gets one active Zoho item under its code.
            Past invoices are untouched. Nothing on an open sales order or draft is retired, each item is re-checked in Zoho before it is
            written, and each batch can be undone.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setResults(new Map());
            void plan.refetch();
          }}
          disabled={plan.isFetching || !!running}
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-border-primary px-3 py-1.5 text-sm hover:bg-fill-muted disabled:opacity-50"
        >
          <IconRefresh size={15} className={plan.isFetching ? 'animate-spin' : ''} /> Read Zoho again
        </button>
      </header>

      {plan.isLoading ? (
        <p className={`${card} px-4 py-6 text-sm text-text-muted`}>Reading every Zoho item and matching it to Stock Explorer…</p>
      ) : plan.error ? (
        <p className={`${card} px-4 py-6 text-sm text-text-danger`}>Could not read Zoho: {plan.error.message}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border-muted bg-border-muted sm:grid-cols-5">
            {TABS.map((t) => {
              const c = counts(t.kind);
              return (
                <button
                  key={t.kind}
                  type="button"
                  onClick={() => setTab(t.kind)}
                  className={`px-3 py-2.5 text-left ${tab === t.kind ? 'bg-fill-brand/10' : 'bg-surface-primary hover:bg-fill-muted/50'}`}
                >
                  <p className="text-[11px] uppercase tracking-wide text-text-muted">{t.label}</p>
                  <p className="text-lg font-semibold tabular-nums text-text-primary">{c.all}</p>
                  {c.blocked ? <p className="text-[11px] text-text-warning">{c.blocked} held back</p> : <p className="text-[11px]">&nbsp;</p>}
                </button>
              );
            })}
          </div>

          <section className={card}>
            <div className="flex flex-col gap-2 border-b border-border-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-3xl text-xs text-text-muted">{current.help}</p>
              {shownReady.length > 0 && (
                <div className="flex shrink-0 gap-2 text-xs">
                  <button type="button" className="underline" onClick={() => toggle(shownReady.map((a) => a.id), true)}>
                    Select all {shownReady.length}
                  </button>
                  <button type="button" className="underline" onClick={() => toggle(shown.map((a) => a.id), false)}>
                    None
                  </button>
                </div>
              )}
            </div>

            {shown.length === 0 ? (
              <p className="px-4 py-6 text-sm text-text-muted">Nothing here.</p>
            ) : (
              <ul className="max-h-[60vh] divide-y divide-border-muted overflow-y-auto">
                {shown.map((a) => {
                  const r = results.get(a.id);
                  const can = ready(a);
                  return (
                    <li key={`${a.id}-${a.kind}`} className="flex gap-3 px-4 py-2.5">
                      <input
                        type="checkbox"
                        className="mt-1 shrink-0"
                        disabled={!can || !!running}
                        checked={can && selected.has(a.id)}
                        onChange={(e) => toggle([a.id], e.target.checked)}
                        aria-label={`Select ${a.name}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-text-primary">{a.name}</p>
                        <p className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-text-muted">
                          <span>{a.sku || 'no SKU'}</span>
                          {a.toSku && (
                            <>
                              <IconArrowRight size={11} />
                              <span>{a.toSku}</span>
                            </>
                          )}
                          {a.toName && (
                            <>
                              <IconArrowRight size={11} />
                              <span className="font-sans text-text-primary">{a.toName}</span>
                            </>
                          )}
                        </p>
                        {a.stockExplorerName && a.stockExplorerName !== a.name && (
                          <p className="text-[11px] text-text-muted">Stock Explorer: {a.stockExplorerName}</p>
                        )}
                        <p className="text-[11px] text-text-muted">{a.reason}</p>
                        {a.blocked && (
                          <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-text-warning">
                            <IconAlertTriangle size={12} /> {a.blocked}
                          </p>
                        )}
                        {r && (
                          <p className={`mt-0.5 inline-flex items-center gap-1 text-[11px] ${r.ok ? 'text-text-success' : 'text-text-danger'}`}>
                            {r.ok ? <IconCheck size={12} /> : <IconX size={12} />} {r.message}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <div className="sticky bottom-0 z-10 flex flex-col gap-2 rounded-xl border border-border-muted bg-surface-primary px-4 py-3 shadow-md sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-text-muted">
              {running ? (
                <>
                  Writing to Zoho… {running.done} of {running.total}
                </>
              ) : (
                <>
                  <span className="font-semibold text-text-primary">{queue.length}</span> change{queue.length === 1 ? '' : 's'} selected across all tabs
                  {results.size > 0 && (
                    <>
                      {' '}
                      · {doneCount} done{skippedCount ? `, ${skippedCount} skipped` : ''}
                    </>
                  )}
                </>
              )}
            </p>
            <div className="flex gap-2">
              {confirming ? (
                <>
                  <button type="button" className="rounded-lg px-3 py-1.5 text-sm hover:bg-fill-muted" onClick={() => setConfirming(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-fill-brand px-3 py-1.5 text-sm font-medium text-text-brand-on-fill hover:bg-fill-brand-hover"
                    onClick={() => void run(queue)}
                  >
                    Write {queue.length} to Zoho
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={!!running || queue.length === 0}
                    className="rounded-lg border border-border-primary px-3 py-1.5 text-sm hover:bg-fill-muted disabled:opacity-50"
                    onClick={() => void run(pilot)}
                    title="Five old items retired with their replacements created, to check in Zoho before the rest"
                  >
                    Try 10 first
                  </button>
                  <button
                    type="button"
                    disabled={!!running || queue.length === 0}
                    className="rounded-lg bg-fill-brand px-3 py-1.5 text-sm font-medium text-text-brand-on-fill hover:bg-fill-brand-hover disabled:opacity-50"
                    onClick={() => setConfirming(true)}
                  >
                    Apply {queue.length}
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {(batches.data?.length ?? 0) > 0 && (
        <section className={card}>
          <h2 className="border-b border-border-muted px-4 py-2.5 text-sm font-semibold">History — open a run to see exactly what it changed</h2>
          <ul className="divide-y divide-border-muted">
            {batches.data!.map((b) => (
              <li key={b.batchId}>
                <div className="flex items-center justify-between gap-3 px-4 py-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setOpenBatch(openBatch === b.batchId ? null : b.batchId)}
                    className="flex items-center gap-1 text-left hover:underline"
                  >
                    <IconChevronDown size={13} className={openBatch === b.batchId ? '' : '-rotate-90'} />
                    {new Date(`${String(b.startedAt).replace(' ', 'T')}Z`).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} ·{' '}
                    {b.inactivated} retired · {b.created} created
                    {b.skipped ? <span className="text-text-warning"> · {b.skipped} skipped</span> : null}
                    {b.live === 0 && <span className="text-text-muted"> · undone</span>}
                  </button>
                  {b.live > 0 && (
                    <button
                      type="button"
                      disabled={!!undoing || !!running}
                      onClick={() => void undo(b.batchId)}
                      className="inline-flex items-center gap-1 rounded-md border border-border-primary px-2 py-1 hover:bg-fill-muted disabled:opacity-50"
                    >
                      <IconArrowBackUp size={13} /> {undoing === b.batchId ? 'Undoing…' : 'Undo'}
                    </button>
                  )}
                </div>
                {openBatch === b.batchId && <BatchChanges batchId={b.batchId} />}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default ZohoCodesClient;
