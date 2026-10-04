'use client';

import DueMenu from './DueMenu';
import GiveToMenu from './GiveToMenu';
import type { Board, BoardPart, BoardTask } from '../types/Board';
import type { CardActions } from '../types/CardActions';
import partLabel from '../utils/partLabel';
import type { PartState } from '../utils/partState';

interface TaskRowProps {
  task: BoardTask;
  part: BoardPart;
  state: PartState;
  board: Board;
  actions: CardActions;
  /** Wide lists (My tasks): show the area and who else is on the job, with the date on the right.
   * Narrow columns (By person) put the date and hand-over under the text instead. */
  showMeta?: boolean;
}

/**
 * One person's part as a single list row: tick, title, what to do, due date
 *
 * Used by My tasks and By person. Jobs on hold and parts waiting for an
 * earlier part cannot be ticked and say why.
 */
const TaskRow = ({ task, part, state, board, actions, showMeta }: TaskRowProps) => {
  const label = partLabel(task.title, part.what);
  const onHold = Boolean(task.waitingOn);
  const first = part.waitsForPartId ? task.parts.find((p) => p.id === part.waitsForPartId) : undefined;
  const firstOwner = first ? board.team.find((m) => m.id === first.ownerId)?.name : undefined;
  const others = [...new Set(task.parts.filter((p) => p.ownerId !== part.ownerId).map((p) => p.ownerId))]
    .map((id) => board.team.find((m) => m.id === id)?.name.split(' ')[0])
    .filter(Boolean);
  const area = board.areas.find((a) => a.id === task.areaId)?.name;
  const done = task.parts.filter((p) => p.done).length;

  const meta = [
    showMeta && area,
    showMeta && others.length > 0 && `with ${others.join(', ')}`,
    showMeta && task.parts.length > 1 && `${done} of ${task.parts.length} parts done`,
    task.linkLabel,
    task.partnerId && `Shared with ${board.partners.find((p) => p.id === task.partnerId)?.name ?? 'a partner'}`,
    task.forTag === 'client' ? 'Client' : task.forTag === 'distributor' ? 'Distributor' : null,
    task.repeat && `Repeats ${task.repeat}`,
  ].filter(Boolean);

  return (
    <div className={`group flex items-start gap-3 px-3 py-2.5 transition hover:bg-fill-secondary/60 ${onHold ? 'opacity-60' : ''}`}>
      <input
        type="checkbox"
        aria-label={`Mark "${task.title}" done`}
        checked={false}
        disabled={state === 'blocked' || onHold || actions.busy}
        onChange={() => actions.onTick(part.id, true)}
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-teal-600 disabled:cursor-not-allowed disabled:opacity-40"
      />
      <div className="min-w-0 flex-1">
        <button type="button" onClick={() => actions.onOpen(task.id)} className="w-full text-left">
          <p className="line-clamp-2 text-sm font-medium leading-snug text-text-primary">
            {task.urgent && !onHold && (
              <span className="mr-1.5 inline-block size-2 -translate-y-px rounded-full bg-fill-danger align-middle" title="Urgent" />
            )}
            {task.title}
          </p>
          {label && <p className="mt-0.5 line-clamp-2 text-xs text-text-secondary">{label}</p>}
          {state === 'blocked' && first && (
            <p className="mt-0.5 text-xs text-text-muted">
              After {firstOwner ?? 'someone'}: {partLabel(task.title, first.what) ?? 'their part'}
            </p>
          )}
          {onHold && <p className="mt-0.5 text-xs text-text-muted">Waiting on: {task.waitingOn}</p>}
          {meta.length > 0 && <p className="mt-0.5 text-[11px] text-text-muted">{meta.join(' · ')}</p>}
        </button>
        {/* Narrow columns: date and hand-over sit under the text so the title keeps its width */}
        {!showMeta && !onHold && (
          <div className="mt-1.5 flex items-center gap-1.5">
            {state !== 'blocked' && (
              <DueMenu partId={part.id} due={part.due} state={state} today={actions.today} urgent={task.urgent} align="left" />
            )}
            <GiveToMenu partId={part.id} ownerId={part.ownerId} board={board} />
          </div>
        )}
      </div>
      {showMeta && !onHold && (
        <>
          <GiveToMenu partId={part.id} ownerId={part.ownerId} board={board} />
          {state !== 'blocked' && (
            <DueMenu partId={part.id} due={part.due} state={state} today={actions.today} urgent={task.urgent} />
          )}
        </>
      )}
    </div>
  );
};

export default TaskRow;
