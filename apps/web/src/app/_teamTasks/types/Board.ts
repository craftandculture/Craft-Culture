import type { inferRouterOutputs } from '@trpc/server';

import type { AppRouter } from '@/trpc-router';

/** The Team Tasks board as the page receives it */
export type Board = inferRouterOutputs<AppRouter>['teamTasks']['getBoard'];

/** One job on the board */
export type BoardTask = Board['tasks'][number];

/** One person's part of a job */
export type BoardPart = BoardTask['parts'][number];
