'use client';

import DueChip from './DueChip';
import PersonBadge from './PersonBadge';
import type { Board, BoardPart, BoardTask } from '../types/Board';
import partLabel from '../utils/partLabel';
import partState from '../utils/partState';
import personName from '../utils/personName';

interface PartRowProps {
  part: BoardPart;
  task: BoardTask;
  board: Board;
  today: string;
  onTick: (partId: string, done: boolean) => void;
  busy?: boolean;
  /** Show "No date" on undated parts (the job panel) */
  showUndated?: boolean;
}

/**
 * One person's part of a job, with its tick box
 *
 * Ticking marks only this part done; the job stays open until someone closes
 * it with the two-step close. A part waiting for another cannot be ticked.
 */
const PartRow = ({ part, task, board, today, onTick, busy, showUndated }: PartRowProps) => {
  const state = partState(part, task, today);
  const owner = board.team.find((m) => m.id === part.ownerId);
  const first = part.waitsForPartId ? task.parts.find((p) => p.id === part.waitsForPartId) : undefined;
  const firstOwner = first ? board.team.find((m) => m.id === first.ownerId) : undefined;
  const locked = task.status !== 'open' || state === 'blocked';

  return (
    <div className="flex items-start gap-2 py-1.5">
      <input
        type="checkbox"
        aria-label={`Mark ${owner?.name ?? 'this'} part done`}
        checked={part.done}
        disabled={locked || busy}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onTick(part.id, e.target.checked)}
        className="mt-1 size-4 shrink-0 cursor-pointer accent-teal-600 disabled:cursor-not-allowed"
      />
      <PersonBadge name={owner?.name ?? '?'} isViewer={part.ownerId === board.viewerId} />
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${part.done ? 'text-text-muted line-through' : 'text-text-primary'}`}>
          {partLabel(task.title, part.what) ?? 'Whole job'}
        </p>
        {state === 'blocked' && first && (
          <p className="text-xs text-text-muted">
            After {firstOwner ? personName(firstOwner.name) : 'someone'}: {partLabel(task.title, first.what) ?? 'their part'}
          </p>
        )}
      </div>
      <DueChip due={part.due} state={state} showUndated={showUndated} />
    </div>
  );
};

export default PartRow;
