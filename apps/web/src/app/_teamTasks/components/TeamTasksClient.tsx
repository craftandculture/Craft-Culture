'use client';

import { IconBrandSlack, IconChevronRight, IconPlus, IconSearch, IconX } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';

import ByPersonView from './ByPersonView';
import DoneView from './DoneView';
import JobForm from './JobForm';
import JobPanel from './JobPanel';
import MyTasksView from './MyTasksView';
import ReviewView from './ReviewView';
import SlackLinksDialog from './SlackLinksDialog';
import StatTiles from './StatTiles';
import TeamBoardView from './TeamBoardView';
import useTaskMutations from '../hooks/useTaskMutations';
import type { BoardTask } from '../types/Board';
import type { CardActions } from '../types/CardActions';
import type { Focus } from '../types/Focus';
import dubaiToday from '../utils/dubaiToday';
import matchesFocus from '../utils/matchesFocus';

type Tab = 'mine' | 'board' | 'people' | 'done' | 'review';

const TABS: { key: Tab; label: string }[] = [
  { key: 'mine', label: 'My tasks' },
  { key: 'board', label: 'Team board' },
  { key: 'people', label: 'By person' },
  { key: 'done', label: 'Done' },
  { key: 'review', label: 'Weekly review' },
];

/** Keep ?job= in the address bar in step with the open panel, without a reload */
const syncJobParam = (taskId: string | null) => {
  const url = new URL(window.location.href);
  ['new', 'title', 'link', 'linkLabel'].forEach((k) => url.searchParams.delete(k));
  if (taskId) url.searchParams.set('job', taskId);
  else url.searchParams.delete('job');
  window.history.replaceState(null, '', url);
};

/**
 * Team Tasks: the team's shared job list
 *
 * Opens on My tasks. Every change is saved in Index; opening, closing,
 * reopening and cancelling a job are posted to #tasks.
 *
 * @param initialJobId - A job to open straight away, from a #tasks link
 * @param prefill - Values for a new job started from another page
 */
const TeamTasksClient = ({
  initialJobId,
  prefill,
}: {
  initialJobId?: string;
  /** Opens the new-job form straight away, e.g. from "Make a job" on an order */
  prefill?: { title?: string; linkUrl?: string; linkLabel?: string };
}) => {
  const api = useTRPC();
  const { data: board, isLoading } = useQuery(api.teamTasks.getBoard.queryOptions());
  const m = useTaskMutations();
  const today = dubaiToday();

  const [tab, setTab] = useState<Tab>('mine');
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [focus, setFocus] = useState<Focus>('');
  const [openId, setOpenId] = useState<string | null>(initialJobId ?? null);
  const [form, setForm] = useState<{ task?: BoardTask; key: number; prefill?: typeof prefill } | null>(
    prefill ? { key: 0, prefill } : null,
  );
  const [slackOpen, setSlackOpen] = useState(false);

  if (isLoading || !board) return <p className="py-16 text-center text-sm text-text-muted">Loading jobs…</p>;

  const q = search.trim().toLowerCase();
  const tasks = board.tasks.filter(
    (t) =>
      (!areaFilter || t.areaId === areaFilter) &&
      matchesFocus(t, focus, today) &&
      (!q ||
        t.title.toLowerCase().includes(q) ||
        t.parts.some((p) => p.what.toLowerCase().includes(q)) ||
        (t.waitingOn ?? '').toLowerCase().includes(q)),
  );

  const open = (taskId: string | null) => {
    setOpenId(taskId);
    syncJobParam(taskId);
  };

  const actions: CardActions = {
    today,
    busy: m.tickPart.isPending || m.closeJob.isPending,
    onOpen: open,
    onTick: (partId, done) =>
      m.tickPart.mutate(
        { partId, done },
        { onSuccess: (r) => r.jobReady && toast.success('Every part is done. Close the job when you are happy.') },
      ),
    onClose: (taskId) =>
      m.closeJob.mutate(
        { taskId },
        { onSuccess: (r) => toast.success(r.nextTaskId ? 'Closed. The next one is on the list.' : 'Job closed.') },
      ),
  };

  // Same rule as the count in the top bar: your open parts, not on hold
  const mineCount = board.tasks
    .filter((t) => t.status === 'open' && !t.waitingOn)
    .flatMap((t) => t.parts)
    .filter((p) => p.ownerId === board.viewerId && !p.done).length;

  const dateLine = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Dubai' }).format(new Date());
  const pill = (active: boolean) =>
    `shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
      active ? 'bg-text-primary text-surface-primary' : 'bg-surface-muted text-text-secondary hover:bg-fill-primary-hover hover:text-text-primary'
    }`;

  return (
    <div className="space-y-5">
      {/* Header, as on Stock Explorer */}
      <div className="tt-controls flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-sm text-text-muted">
            <Link href="/platform/admin/home" className="transition-colors hover:text-text-primary">
              Admin
            </Link>
            <IconChevronRight className="size-4" />
            <span className="text-text-primary">Team Tasks</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Team Tasks</h1>
          <p className="mt-0.5 text-sm text-text-muted">{dateLine} — who is doing what, and by when</p>
        </div>
        <div className="flex items-center gap-2">
          {board.viewerIsAdmin && (
            <button
              type="button"
              onClick={() => setSlackOpen(true)}
              title={board.slackConnected ? 'Link Slack accounts' : '#tasks is not connected'}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-border-muted bg-surface-primary px-3 text-sm font-medium text-text-secondary shadow-sm transition-colors hover:text-text-primary"
            >
              <IconBrandSlack className="size-4" />
              <span className="hidden sm:inline">Slack</span>
              <span className={`size-1.5 rounded-full ${board.slackConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setForm({ key: Date.now() })}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-text-primary px-4 text-sm font-semibold text-surface-primary shadow-sm transition hover:opacity-90"
          >
            <IconPlus className="size-4" />
            New job
          </button>
        </div>
      </div>

      {!board.slackConnected && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          #tasks is not connected yet, so nothing is posted to Slack. Everything is still saved here.
        </div>
      )}

      <div className="tt-controls">
        <StatTiles tasks={board.tasks} today={today} focus={focus} onFocus={setFocus} />
      </div>

      <div className="tt-controls space-y-3">
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jobs, parts or who it is waiting on…"
            className="h-11 w-full rounded-xl border border-border-muted bg-surface-primary shadow-sm pl-9 pr-3 text-sm text-text-primary shadow-sm placeholder:text-text-muted focus:border-text-muted focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex max-w-full gap-2 overflow-x-auto">
            {TABS.map((t) => (
              <button key={t.key} type="button" onClick={() => setTab(t.key)} className={pill(tab === t.key)}>
                {t.label}
                {t.key === 'mine' && mineCount > 0 && (
                  <span className={`ml-1.5 tabular-nums ${tab === t.key ? 'opacity-70' : 'text-text-muted'}`}>{mineCount}</span>
                )}
              </button>
            ))}
          </div>
          {tab !== 'review' && (
            <>
              <div className="mx-1 hidden h-4 w-px bg-border-muted sm:block" />
              <select
                value={areaFilter}
                onChange={(e) => setAreaFilter(e.target.value)}
                aria-label="Area"
                className={`h-9 rounded-full border px-3 text-sm ${
                  areaFilter ? 'border-text-primary bg-text-primary text-surface-primary' : 'border-border-muted bg-surface-primary text-text-secondary'
                }`}
              >
                <option value="">All areas</option>
                {board.areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              {tab !== 'done' && (
                <button type="button" onClick={() => setFocus(focus === 'urgent' ? '' : 'urgent')} className={pill(focus === 'urgent')}>
                  Urgent
                </button>
              )}
            </>
          )}
          {(focus || areaFilter || search) && (
            <button
              type="button"
              onClick={() => {
                setFocus('');
                setAreaFilter('');
                setSearch('');
              }}
              className="ml-auto flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text-primary"
            >
              <IconX className="size-3.5" />
              Clear filters
            </button>
          )}
        </div>
      </div>

      {tab === 'mine' && <MyTasksView board={board} tasks={tasks} actions={actions} />}
      {tab === 'board' && <TeamBoardView board={board} tasks={tasks} actions={actions} />}
      {tab === 'people' && <ByPersonView board={board} tasks={tasks} actions={actions} />}
      {tab === 'done' && <DoneView board={board} tasks={tasks} actions={actions} />}
      {tab === 'review' && <ReviewView board={board} tasks={tasks} today={today} />}

      <JobPanel
        task={board.tasks.find((t) => t.id === openId)}
        board={board}
        today={today}
        onClose={() => open(null)}
        onEdit={(task) => setForm({ task, key: Date.now() })}
      />

      {form && (
        <JobForm
          key={form.key}
          board={board}
          today={today}
          task={form.task}
          prefill={form.prefill}
          open
          onOpenChange={(o) => !o && setForm(null)}
          onSaved={(taskId) => !form.task && open(taskId)}
        />
      )}

      {slackOpen && <SlackLinksDialog board={board} open onOpenChange={setSlackOpen} />}
    </div>
  );
};

export default TeamTasksClient;
