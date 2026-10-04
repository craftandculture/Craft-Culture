'use client';

import JobCard from './JobCard';
import Section from './Section';
import type { Board, BoardTask } from '../types/Board';
import type { CardActions } from '../types/CardActions';

/** Team board: every open job, grouped by area, urgent jobs first */
const TeamBoardView = ({ board, tasks, actions }: { board: Board; tasks: BoardTask[]; actions: CardActions }) => {
  const open = tasks.filter((t) => t.status === 'open');

  if (!open.length) return <p className="py-12 text-center text-sm text-text-muted">No open jobs match.</p>;

  return (
    <div className="space-y-6">
      {board.areas.map((area) => {
        const items = open
          .filter((t) => t.areaId === area.id)
          .sort((a, b) => Number(b.urgent) - Number(a.urgent));
        return (
          <Section key={area.id} title={area.name} count={items.length}>
            {items.map((t) => (
              <JobCard key={t.id} task={t} board={board} hideArea {...actions} />
            ))}
          </Section>
        );
      })}
    </div>
  );
};

export default TeamBoardView;
