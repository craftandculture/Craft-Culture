'use client';

import DueChip from './DueChip';
import DueMenu from './DueMenu';
import PersonBadge from './PersonBadge';
import TickBox from './TickBox';
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
  /** The job panel: name the owner in full and allow changing the date */
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
    <div className="group flex items-start gap-2 py-1.5">
      <TickBox
        label={`Mark ${owner?.name ?? 'this'} part done`}
        checked={part.done}
        disabled={locked || busy}
        onChange={(checked) => onTick(part.id, checked)}
      />
      <PersonBadge name={owner?.name ?? '?'} isViewer={part.ownerId === board.viewerId} />
      <div className="min-w-0 flex-1">
        {showUndated && <p className="text-[11px] font-medium text-text-muted">{owner ? personName(owner.name) : 'Unassigned'}</p>}
        <p className={`text-sm ${part.done ? 'text-text-muted line-through' : 'text-text-primary'}`}>
          {showUndated ? part.what : (partLabel(task.title, part.what) ?? (owner ? personName(owner.name) : 'Unassigned'))}
        </p>
        {state === 'blocked' && first && (
          <p className="text-xs text-text-muted">
            After {firstOwner ? personName(firstOwner.name) : 'someone'}: {partLabel(task.title, first.what) ?? 'their part'}
          </p>
        )}
      </div>
      {showUndated && task.status === 'open' && !part.done && state !== 'blocked' ? (
        <DueMenu partId={part.id} due={part.due} state={state} today={today} urgent={task.urgent} />
      ) : (
        <DueChip due={part.due} state={state} showUndated={showUndated} />
      )}
    </div>
  );
};

export default PartRow;
