'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';

import ByPersonView from './ByPersonView';
import DoneView from './DoneView';
import JobForm from './JobForm';
import JobPanel from './JobPanel';
import MyTasksView from './MyTasksView';
import SlackLinksDialog from './SlackLinksDialog';
import TeamBoardView from './TeamBoardView';
import useTaskMutations from '../hooks/useTaskMutations';
import type { BoardTask } from '../types/Board';
import type { CardActions } from '../types/CardActions';
import dubaiToday from '../utils/dubaiToday';

type Tab = 'mine' | 'board' | 'people' | 'done';

const TABS: { key: Tab; label: string }[] = [
  { key: 'mine', label: 'My tasks' },
  { key: 'board', label: 'Team board' },
  { key: 'people', label: 'By person' },
  { key: 'done', label: 'Done' },
];

/** Keep ?job= in the address bar in step with the open panel, without a reload */
const syncJobParam = (taskId: string | null) => {
  const url = new URL(window.location.href);
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
 */
const TeamTasksClient = ({ initialJobId }: { initialJobId?: string }) => {
  const api = useTRPC();
  const { data: board, isLoading } = useQuery(api.teamTasks.getBoard.queryOptions());
  const m = useTaskMutations();
  const today = dubaiToday();

  const [tab, setTab] = useState<Tab>('mine');
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [openId, setOpenId] = useState<string | null>(initialJobId ?? null);
  const [form, setForm] = useState<{ task?: BoardTask; key: number } | null>(null);
  const [slackOpen, setSlackOpen] = useState(false);

  if (isLoading || !board) return <p className="text-sm text-text-muted">Loading jobs…</p>;

  const q = search.trim().toLowerCase();
  const tasks = board.tasks.filter(
    (t) =>
      (!areaFilter || t.areaId === areaFilter) &&
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

  const mineCount = board.tasks.filter(
    (t) => t.status === 'open' && t.parts.some((p) => p.ownerId === board.viewerId && !p.done),
  ).length;

  return (
    <div className="space-y-4">
      {!board.slackConnected && (
        <div className="rounded-lg border border-border-warning bg-fill-warning/10 px-3 py-2 text-sm text-text-warning">
          #tasks is not connected yet, so nothing is posted to Slack. Everything is still saved here.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border-muted bg-fill-secondary p-0.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`h-8 rounded-md px-3 text-sm font-medium ${
                tab === t.key ? 'bg-surface-primary text-text-primary shadow-xs' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {t.label}
              {t.key === 'mine' && mineCount > 0 && <span className="ml-1.5 text-xs text-text-brand">{mineCount}</span>}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search jobs"
          className="h-9 w-48 rounded-lg border border-border-primary bg-surface-primary px-2.5 text-sm text-text-primary"
        />
        <select
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
          className="h-9 rounded-lg border border-border-primary bg-surface-primary px-2 text-sm text-text-primary"
        >
          <option value="">All areas</option>
          {board.areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          {board.viewerIsAdmin && (
            <button
              type="button"
              onClick={() => setSlackOpen(true)}
              className="h-9 rounded-lg px-3 text-sm text-text-muted hover:text-text-primary"
            >
              Slack accounts
            </button>
          )}
          <button
            type="button"
            onClick={() => setForm({ key: Date.now() })}
            className="h-9 rounded-lg border border-border-brand bg-fill-brand px-4 text-sm font-medium text-text-brand-on-fill"
          >
            + New job
          </button>
        </div>
      </div>

      {tab === 'mine' && <MyTasksView board={board} tasks={tasks} actions={actions} />}
      {tab === 'board' && <TeamBoardView board={board} tasks={tasks} actions={actions} />}
      {tab === 'people' && <ByPersonView board={board} tasks={tasks} actions={actions} />}
      {tab === 'done' && <DoneView board={board} tasks={tasks} actions={actions} />}

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
