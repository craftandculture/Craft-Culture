import { z } from 'zod';

import db from '@/database/client';
import { teamProcedure } from '@/lib/trpc/procedures';

import resolveArea from '../data/resolveArea';

/**
 * Add an area (a column on the Team board); reuses one with the same name
 *
 * @example
 *   await trpcClient.teamTasks.createArea.mutate({ name: 'Marketing' });
 */
const createArea = teamProcedure
  .input(z.object({ name: z.string().trim().min(1).max(60) }))
  .mutation(async ({ input }) => ({ areaId: await resolveArea(db, null, input.name) }));

export default createArea;
