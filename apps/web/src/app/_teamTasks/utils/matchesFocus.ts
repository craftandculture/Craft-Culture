import partState from './partState';
import type { BoardTask } from '../types/Board';
import type { Focus } from '../types/Focus';

/**
 * Whether a job belongs under one of the summary tiles
 *
 * The tiles count with this same rule, so a tile's number always matches
 * what clicking it shows.
 */
const matchesFocus = (t: BoardTask, focus: Focus, today: string) => {
  if (!focus) return true;
  if (focus === 'hold') return t.status === 'open' && Boolean(t.waitingOn);
  if (t.status !== 'open' || t.waitingOn) return false;

  const states = t.parts.filter((p) => !p.done).map((p) => partState(p, t, today));
  switch (focus) {
    case 'urgent':
      return t.urgent;
    case 'overdue':
      return states.includes('overdue');
    case 'week':
      return states.includes('today') || states.includes('week');
    case 'nodate':
      return t.urgent && t.parts.some((p) => !p.done && !p.due && partState(p, t, today) !== 'blocked');
    case 'ready':
      return t.parts.length > 0 && t.parts.every((p) => p.done);
    default:
      return true;
  }
};

export default matchesFocus;
