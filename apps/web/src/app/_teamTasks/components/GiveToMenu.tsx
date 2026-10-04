'use client';

import useTaskMutations from '../hooks/useTaskMutations';
import type { Board } from '../types/Board';

/**
 * "Give to…": hand one part to someone else from the list
 *
 * The new owner is tagged in #tasks. Shown on hover on a desktop, always on a
 * phone.
 */
const GiveToMenu = ({ partId, ownerId, board }: { partId: string; ownerId: string; board: Board }) => {
  const { reassignPart } = useTaskMutations();

  return (
    <select
      aria-label="Give this part to someone else"
      value=""
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => e.target.value && reassignPart.mutate({ partId, ownerId: e.target.value })}
      className="h-7 w-24 shrink-0 cursor-pointer rounded-md border border-transparent bg-transparent px-1 text-[11px] text-text-muted transition hover:border-border-muted md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
    >
      <option value="">Give to…</option>
      {board.team
        .filter((m) => m.id !== ownerId && !m.partnerId)
        .map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
    </select>
  );
};

export default GiveToMenu;
