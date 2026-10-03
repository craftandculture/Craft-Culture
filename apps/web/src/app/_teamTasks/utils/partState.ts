import type { BoardPart, BoardTask } from '../types/Board';

export type PartState = 'done' | 'blocked' | 'overdue' | 'today' | 'week' | 'later' | 'undated';

/**
 * Where a part stands today, for sorting and for the colour of its date
 *
 * "Blocked" means it waits for another part of the job that is not done yet,
 * so its owner cannot start. A blocked part is never shown as overdue.
 *
 * @param part - The part
 * @param task - The job it belongs to
 * @param today - Today in Dubai, YYYY-MM-DD
 */
const partState = (part: BoardPart, task: BoardTask, today: string): PartState => {
  if (part.done) return 'done';
  if (part.waitsForPartId && task.parts.some((p) => p.id === part.waitsForPartId && !p.done)) return 'blocked';
  if (!part.due) return 'undated';
  if (part.due < today) return 'overdue';
  if (part.due === today) return 'today';

  const weekOut = new Date(`${today}T12:00:00Z`);
  weekOut.setUTCDate(weekOut.getUTCDate() + 6);

  return part.due <= weekOut.toISOString().slice(0, 10) ? 'week' : 'later';
};

export default partState;
