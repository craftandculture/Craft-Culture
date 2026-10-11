import type { CleanupAction } from './planSkuCleanup';

const LATER: Record<CleanupAction['kind'], number> = { retire: 0, retire_duplicate: 1, retire_not_held: 2, create: 3, set_customs: 4, review: 9 };

/**
 * The order a run writes in, and the pilot
 *
 * An old item is never retired without its replacement: each retirement that
 * has one is followed straight away by that creation, chosen or not, so even
 * a run cut short leaves no wine without an active item. A creation that
 * takes a retiring item's name waits for that retirement. The pilot is five
 * such pairs.
 *
 * @param actions - The plan
 * @param selected - Ids the operator has selected
 * @param done - Ids already written this session
 * @returns The full queue and the pilot
 */
const buildRunQueue = (actions: CleanupAction[], selected: Set<string>, done: Set<string>) => {
  const ready = (a: CleanupAction) => !a.blocked && a.kind !== 'review' && !done.has(a.id);
  const createFor = new Map(actions.filter((a) => a.kind === 'create' && ready(a)).map((a) => [a.canonical, a]));

  const chosen = actions.filter((a) => selected.has(a.id) && ready(a)).sort((a, b) => LATER[a.kind] - LATER[b.kind]);
  const queued = new Set<string>();
  const queue: CleanupAction[] = [];
  const pairs: CleanupAction[][] = [];

  for (const a of chosen) {
    if (queued.has(a.id)) continue;
    if (a.kind === 'create' && a.dependsOn && !done.has(a.dependsOn) && !queued.has(a.dependsOn)) continue;
    queue.push(a);
    queued.add(a.id);
    const partner = a.replacedBy ? createFor.get(a.replacedBy) : undefined;
    if (partner && !queued.has(partner.id)) {
      queue.push(partner);
      queued.add(partner.id);
      pairs.push([a, partner]);
    }
  }

  const pilot = pairs.length ? pairs.slice(0, 5).flat() : queue.slice(0, 10);
  return { queue, pilot };
};

export default buildRunQueue;
