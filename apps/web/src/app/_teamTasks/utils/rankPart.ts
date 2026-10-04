import type { PartState } from './partState';
import type { BoardTask } from '../types/Board';

const byState: Record<PartState, number> = { overdue: 0, today: 1, week: 2, later: 5, undated: 6, blocked: 8, done: 10 };

/**
 * Sort key for a part on a to-do list: overdue, today, this week, then urgent
 * work without a near date, then the rest; parts that cannot start yet and
 * jobs on hold go last
 */
const rankPart = (task: BoardTask, state: PartState) => {
  if (task.waitingOn) return 9;
  const base = byState[state];
  return task.urgent && base >= 5 && base < 8 ? 3 : base;
};

export default rankPart;
