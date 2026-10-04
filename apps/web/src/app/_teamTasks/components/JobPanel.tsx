'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import Sheet from '@/app/_ui/components/Sheet/Sheet';
import SheetContent from '@/app/_ui/components/Sheet/SheetContent';
import SheetTitle from '@/app/_ui/components/Sheet/SheetTitle';
import useTRPC from '@/lib/trpc/browser';

import PartRow from './PartRow';
import TwoStepButton from './TwoStepButton';
import useTaskMutations from '../hooks/useTaskMutations';
import type { Board, BoardTask } from '../types/Board';

interface JobPanelProps {
  task: BoardTask | undefined;
  board: Board;
  today: string;
  onClose: () => void;
  onEdit: (task: BoardTask) => void;
}

const when = (at: Date | string) =>
  new Date(at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' });

/**
 * The job panel: every part, the notes, the history and the job's actions
 *
 * Close and cancel both need two presses. A closed or cancelled job can be
 * reopened from here. Opened from a card or from a #tasks link (?job=).
 */
const JobPanel = ({ task, board, today, onClose, onEdit }: JobPanelProps) => {
  const api = useTRPC();
  const m = useTaskMutations();
  const [note, setNote] = useState('');

  const { data: detail } = useQuery({
    ...api.teamTasks.getTask.queryOptions({ taskId: task?.id ?? '00000000-0000-0000-0000-000000000000' }),
    enabled: Boolean(task),
  });

  const area = task ? board.areas.find((a) => a.id === task.areaId) : undefined;
  const allDone = Boolean(task && task.parts.length > 0 && task.parts.every((p) => p.done));
  const busy = m.tickPart.isPending || m.closeJob.isPending || m.reopenJob.isPending || m.cancelJob.isPending;

  return (
    <Sheet open={Boolean(task)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col overflow-y-auto p-5 sm:max-w-lg">
        {task && (
          <>
            <div className="relative pr-8">
              <button
                type="button"
                onClick={onClose}
                aria-label="Close panel"
                className="absolute right-0 top-0 flex size-8 items-center justify-center rounded-lg text-lg text-text-muted hover:bg-fill-secondary hover:text-text-primary"
              >
                ✕
              </button>
              <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
                {area?.name}
                {task.status !== 'open' && ` · ${task.status === 'closed' ? 'Closed' : 'Cancelled'}`}
              </p>
              <SheetTitle className="mt-1 text-lg font-semibold leading-snug text-text-primary">{task.title}</SheetTitle>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                {task.urgent && <span className="rounded-full bg-fill-danger/15 px-2 py-0.5 font-semibold text-text-danger">Urgent</span>}
                {task.forTag && (
                  <span className="rounded-full bg-fill-muted px-2 py-0.5 text-text-muted">
                    {task.forTag === 'client' ? 'Client' : 'Distributor'}
                  </span>
                )}
                {task.repeat && <span className="rounded-full bg-fill-muted px-2 py-0.5 text-text-muted">Repeats {task.repeat}</span>}
                {task.partnerId && (
                  <span className="rounded-full bg-fill-brand/10 px-2 py-0.5 text-text-brand">
                    Shared with {board.partners.find((p) => p.id === task.partnerId)?.name ?? 'a partner'}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-border-muted pb-4">
              {task.status === 'open' ? (
                <>
                  <button
                    type="button"
                    onClick={() => onEdit(task)}
                    className="h-8 rounded-lg border border-border-primary bg-fill-primary px-3 text-sm font-medium text-text-primary"
                  >
                    Edit
                  </button>
                  <TwoStepButton
                    label="Close job"
                    confirmLabel="Yes, close it"
                    disabled={!allDone || busy}
                    onConfirm={() => m.closeJob.mutate({ taskId: task.id })}
                  />
                  <TwoStepButton
                    label="Cancel job"
                    confirmLabel="Yes, cancel it"
                    tone="danger"
                    disabled={busy}
                    onConfirm={() => m.cancelJob.mutate({ taskId: task.id }, { onSuccess: onClose })}
                  />
                  {!allDone && <span className="text-xs text-text-muted">Tick every part to close.</span>}
                </>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => m.reopenJob.mutate({ taskId: task.id })}
                  className="h-8 rounded-lg border border-border-primary bg-fill-primary px-3 text-sm font-medium text-text-primary"
                >
                  Reopen job
                </button>
              )}
            </div>

            {task.linkUrl && (
              <a
                href={task.linkUrl}
                className="flex items-center justify-between rounded-lg border border-border-muted px-3 py-2 text-sm hover:border-border-brand"
              >
                <span className="text-text-primary">
                  About <span className="font-medium">{task.linkLabel ?? 'a linked page'}</span>
                </span>
                <span className="text-xs text-text-brand">Open &rarr;</span>
              </a>
            )}

            {task.waitingOn && task.status === 'open' && (
              <div className="flex items-center justify-between gap-2 rounded-lg bg-fill-warning/15 px-3 py-2">
                <span className="text-sm text-text-warning">Waiting on: {task.waitingOn}</span>
                <button
                  type="button"
                  onClick={() => m.goAhead.mutate({ taskId: task.id })}
                  disabled={m.goAhead.isPending}
                  className="h-7 shrink-0 rounded-lg border border-border-brand bg-fill-brand px-2.5 text-xs font-medium text-text-brand-on-fill"
                >
                  Go ahead, start now
                </button>
              </div>
            )}

            <div>
              <p className="mb-1 text-xs font-medium text-text-muted">Parts</p>
              <div className="divide-y divide-border-muted rounded-lg border border-border-muted px-2.5">
                {task.parts.map((p) => (
                  <PartRow
                    key={p.id}
                    part={p}
                    task={task}
                    board={board}
                    today={today}
                    busy={busy}
                    showUndated
                    onTick={(partId, done) => m.tickPart.mutate({ partId, done })}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-text-muted">Notes</p>
              <div className="space-y-2">
                {detail?.notes.map((n) => (
                  <div key={n.id} className="rounded-lg bg-fill-secondary px-3 py-2">
                    <p className="text-[11px] text-text-muted">
                      {n.name} · {when(n.at)}
                    </p>
                    <p className="whitespace-pre-wrap text-sm text-text-primary">{n.body}</p>
                  </div>
                ))}
                <div className="flex gap-2">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="Add a note for the team"
                    className="flex-1 rounded-lg border border-border-primary bg-surface-primary px-2.5 py-1.5 text-sm text-text-primary"
                  />
                  <button
                    type="button"
                    disabled={!note.trim() || m.addNote.isPending}
                    onClick={() => m.addNote.mutate({ taskId: task.id, body: note.trim() }, { onSuccess: () => setNote('') })}
                    className="h-9 self-end rounded-lg border border-border-primary bg-fill-primary px-3 text-sm font-medium text-text-primary disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-text-muted">History</p>
              <ul className="space-y-1">
                {detail?.events.map((e) => (
                  <li key={e.id} className="text-xs text-text-muted">
                    <span className="text-text-primary">{e.text}</span> · {when(e.at)}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default JobPanel;
