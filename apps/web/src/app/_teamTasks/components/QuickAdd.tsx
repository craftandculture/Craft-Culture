'use client';

import { useState } from 'react';

import useTaskMutations from '../hooks/useTaskMutations';
import type { Board } from '../types/Board';

/**
 * Quick add: type a job, press Enter, and it is on your list
 *
 * Filed under Other with no date; open it afterwards to add people, an area
 * or a date. Like any new job, it is posted to #tasks.
 */
const QuickAdd = ({ board }: { board: Board }) => {
  const { createJob } = useTaskMutations();
  const [title, setTitle] = useState('');
  const area = board.areas.find((a) => a.name === 'Other') ?? board.areas[0];

  const submit = () => {
    const t = title.trim();
    if (!t || createJob.isPending) return;
    createJob.mutate(
      {
        title: t,
        areaId: area?.id ?? null,
        newAreaName: area ? null : 'Other',
        forTag: null,
        urgent: false,
        waitingOn: null,
        repeat: null,
        parts: [{ ownerId: board.viewerId, what: t, due: null, waitsForIndex: null }],
      },
      { onSuccess: () => setTitle('') },
    );
  };

  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-border-muted bg-surface-primary px-3 py-1.5 focus-within:border-text-muted">
      <span className="text-lg leading-none text-text-muted">+</span>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="Add a job for yourself and press Enter"
        aria-label="Quick add a job"
        className="h-8 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
      />
      {title.trim() && (
        <span className="text-[11px] text-text-muted">{createJob.isPending ? 'Adding…' : 'Enter to add'}</span>
      )}
    </div>
  );
};

export default QuickAdd;
