import { sql } from 'drizzle-orm';

import { teamTaskAreas } from '@/database/schema';

/**
 * The area a job goes in: an existing one, or a new one created by name
 *
 * A new name that matches an existing area (ignoring case) reuses it rather
 * than making a near-duplicate column.
 *
 * @param tx - Drizzle handle (the surrounding transaction)
 * @param areaId - An existing area, if chosen
 * @param newAreaName - A new area's name, if typed
 * @returns The area id
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const resolveArea = async (tx: any, areaId: string | null, newAreaName: string | null) => {
  if (!newAreaName) return areaId as string;

  const [existing] = await tx
    .select({ id: teamTaskAreas.id })
    .from(teamTaskAreas)
    .where(sql`lower(${teamTaskAreas.name}) = lower(${newAreaName})`);
  if (existing) return existing.id as string;

  const [{ max }] = await tx
    .select({ max: sql<number>`coalesce(max(${teamTaskAreas.position}), 0)::int` })
    .from(teamTaskAreas);
  const [created] = await tx
    .insert(teamTaskAreas)
    .values({ name: newAreaName, position: max + 1 })
    .returning({ id: teamTaskAreas.id });

  return created.id as string;
};

export default resolveArea;
