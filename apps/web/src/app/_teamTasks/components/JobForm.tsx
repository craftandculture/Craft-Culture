'use client';

import { useState } from 'react';

import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogBody from '@/app/_ui/components/Dialog/DialogBody';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import DialogFooter from '@/app/_ui/components/Dialog/DialogFooter';
import DialogHeader from '@/app/_ui/components/Dialog/DialogHeader';
import DialogTitle from '@/app/_ui/components/Dialog/DialogTitle';

import useTaskMutations from '../hooks/useTaskMutations';
import type { JobInput } from '../schemas/jobSchema';
import type { Board, BoardTask } from '../types/Board';
import quickDue, { type QuickDue } from '../utils/quickDue';

interface JobFormProps {
  board: Board;
  today: string;
  /** The job being edited; omitted when adding */
  task?: BoardTask;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (taskId: string) => void;
}

type FormPart = JobInput['parts'][number];

const NEW_AREA = '__new__';
const QUICK: { key: QuickDue; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'friday', label: 'Friday' },
  { key: 'nextWeek', label: 'Next week' },
];

const field = 'h-9 w-full rounded-lg border border-border-primary bg-surface-primary px-2.5 text-sm text-text-primary';
const label = 'mb-1 block text-xs font-medium text-text-muted';

/**
 * Add or edit a job: title, area, its parts (who does what, by when) and flags
 *
 * Anyone on the team can edit any job. A part can wait for another part of the
 * same job; its owner is told in #tasks when it is their turn.
 */
const JobForm = ({ board, today, task, open, onOpenChange, onSaved }: JobFormProps) => {
  const { createJob, updateJob } = useTaskMutations();

  const [title, setTitle] = useState(task?.title ?? '');
  const [areaId, setAreaId] = useState<string>(task?.areaId ?? board.areas[0]?.id ?? NEW_AREA);
  const [newAreaName, setNewAreaName] = useState('');
  const [forTag, setForTag] = useState<JobInput['forTag']>(task?.forTag ?? null);
  const [urgent, setUrgent] = useState(task?.urgent ?? false);
  const [waiting, setWaiting] = useState(Boolean(task?.waitingOn));
  const [waitingOn, setWaitingOn] = useState(task?.waitingOn ?? '');
  const [repeat, setRepeat] = useState<JobInput['repeat']>(task?.repeat ?? null);
  const [parts, setParts] = useState<FormPart[]>(
    task?.parts.map((p) => ({
      id: p.id,
      ownerId: p.ownerId,
      what: p.what,
      due: p.due,
      waitsForIndex: p.waitsForPartId ? Math.max(-1, task.parts.findIndex((q) => q.id === p.waitsForPartId)) : null,
    })) ?? [{ ownerId: board.viewerId, what: '', due: null, waitsForIndex: null }],
  );
  const [error, setError] = useState<string | null>(null);

  const setPart = (i: number, patch: Partial<FormPart>) =>
    setParts((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const removePart = (i: number) =>
    setParts((ps) =>
      ps
        .filter((_, j) => j !== i)
        .map((p) => ({
          ...p,
          waitsForIndex:
            p.waitsForIndex === null || p.waitsForIndex === i ? null : p.waitsForIndex > i ? p.waitsForIndex - 1 : p.waitsForIndex,
        })),
    );

  const saving = createJob.isPending || updateJob.isPending;

  const submit = async () => {
    setError(null);
    const cleanParts = parts.map((p) => ({ ...p, waitsForIndex: p.waitsForIndex !== null && p.waitsForIndex >= 0 ? p.waitsForIndex : null }));

    if (!title.trim()) return setError('Give the job a title.');
    if (areaId === NEW_AREA && !newAreaName.trim()) return setError('Name the new area.');
    if (cleanParts.some((p) => !p.what.trim())) return setError('Fill in what each person does, in the box next to their name.');
    if (urgent && cleanParts.some((p) => !p.due)) return setError('Urgent jobs need a due date on every part.');

    const input: JobInput = {
      title: title.trim(),
      areaId: areaId === NEW_AREA ? null : areaId,
      newAreaName: areaId === NEW_AREA ? newAreaName.trim() : null,
      forTag,
      urgent,
      waitingOn: waiting && waitingOn.trim() ? waitingOn.trim() : null,
      repeat,
      parts: cleanParts,
    };

    if (task) {
      await updateJob.mutateAsync({ ...input, taskId: task.id });
      onSaved?.(task.id);
    } else {
      const result = await createJob.mutateAsync(input);
      onSaved?.(result.taskId);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{task ? 'Edit job' : 'New job'}</DialogTitle>
        </DialogHeader>
        <DialogBody className="max-h-[70vh] space-y-4 overflow-y-auto">
          <div>
            <label className={label} htmlFor="tt-title">
              Job
            </label>
            <input
              id="tt-title"
              className={field}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Wynn: send revised quote"
              autoFocus
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={label} htmlFor="tt-area">
                Area
              </label>
              <select id="tt-area" className={field} value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                {board.areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
                <option value={NEW_AREA}>+ New area…</option>
              </select>
              {areaId === NEW_AREA && (
                <input
                  className={`${field} mt-2`}
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  placeholder="Area name"
                />
              )}
            </div>
            <div>
              <label className={label} htmlFor="tt-for">
                For
              </label>
              <select
                id="tt-for"
                className={field}
                value={forTag ?? ''}
                onChange={(e) => setForTag((e.target.value || null) as JobInput['forTag'])}
              >
                <option value="">Internal</option>
                <option value="client">A client</option>
                <option value="distributor">A distributor</option>
              </select>
            </div>
            <div>
              <label className={label} htmlFor="tt-repeat">
                Repeats
              </label>
              <select
                id="tt-repeat"
                className={field}
                value={repeat ?? ''}
                onChange={(e) => setRepeat((e.target.value || null) as JobInput['repeat'])}
              >
                <option value="">Does not repeat</option>
                <option value="weekly">Every week</option>
                <option value="monthly">Every month</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-text-primary">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} className="accent-teal-600" />
              Urgent <span className="text-xs text-text-muted">(needs a date on every part)</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={waiting} onChange={(e) => setWaiting(e.target.checked)} className="accent-teal-600" />
              Waiting on someone before we start
            </label>
          </div>
          {waiting && (
            <input
              className={field}
              value={waitingOn}
              onChange={(e) => setWaitingOn(e.target.value)}
              placeholder="Who or what, e.g. Client go-ahead, Julian to confirm"
            />
          )}

          <div className="space-y-2">
            <p className={label}>Who does what</p>
            {parts.map((p, i) => (
              <div key={p.id ?? `new-${i}`} className="space-y-2 rounded-lg border border-border-muted p-2.5">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    aria-label="Owner"
                    className="h-9 w-full shrink-0 rounded-lg border border-border-primary bg-surface-primary px-2.5 text-sm text-text-primary sm:w-44"
                    value={p.ownerId}
                    onChange={(e) => setPart(i, { ownerId: e.target.value })}
                  >
                    {board.team.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label="What"
                    className={`${field} min-w-0 sm:flex-1`}
                    value={p.what}
                    onChange={(e) => setPart(i, { what: e.target.value })}
                    placeholder="What they do, e.g. Send the shipping quote"
                  />
                  {parts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePart(i)}
                      className="shrink-0 px-2 text-sm text-text-muted hover:text-text-danger"
                      aria-label="Remove part"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <input
                    type="date"
                    aria-label="Due"
                    className="h-8 rounded-lg border border-border-primary bg-surface-primary px-2 text-sm text-text-primary"
                    value={p.due ?? ''}
                    onChange={(e) => setPart(i, { due: e.target.value || null })}
                  />
                  {QUICK.map((q) => {
                    const value = quickDue(q.key, today);
                    return (
                      <button
                        key={q.key}
                        type="button"
                        onClick={() => setPart(i, { due: value })}
                        className={`h-7 rounded-full border px-2.5 text-xs ${
                          p.due === value
                            ? 'border-border-brand bg-fill-brand/10 text-text-brand'
                            : 'border-border-muted text-text-muted hover:text-text-primary'
                        }`}
                      >
                        {q.label}
                      </button>
                    );
                  })}
                  {p.due && (
                    <button type="button" onClick={() => setPart(i, { due: null })} className="text-xs text-text-muted underline">
                      No date
                    </button>
                  )}
                  {parts.length > 1 && (
                    <select
                      aria-label="Waits for"
                      className="ml-auto h-8 rounded-lg border border-border-primary bg-surface-primary px-2 text-xs text-text-primary"
                      value={p.waitsForIndex ?? ''}
                      onChange={(e) => setPart(i, { waitsForIndex: e.target.value === '' ? null : Number(e.target.value) })}
                    >
                      <option value="">Can start now</option>
                      {parts.map((q, j) =>
                        j === i ? null : (
                          <option key={j} value={j}>
                            After {board.team.find((m) => m.id === q.ownerId)?.name ?? '?'}: {q.what || `part ${j + 1}`}
                          </option>
                        ),
                      )}
                    </select>
                  )}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setParts((ps) => [...ps, { ownerId: board.viewerId, what: '', due: null, waitsForIndex: null }])}
              className="text-sm font-medium text-text-brand"
            >
              + Add a part for someone else
            </button>
          </div>

          {error && <p className="text-sm text-text-danger">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <div className="flex w-full justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-9 rounded-lg px-3 text-sm text-text-muted hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void submit().catch(() => undefined)}
              className="h-9 rounded-lg border border-border-brand bg-fill-brand px-4 text-sm font-medium text-text-brand-on-fill disabled:opacity-50"
            >
              {saving ? 'Saving…' : task ? 'Save changes' : 'Add job'}
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default JobForm;
