import { and, eq, ilike, inArray } from 'drizzle-orm';

import db from '@/database/client';
import { teamTaskPeople, users } from '@/database/schema';

/**
 * The C&C team: staff logins with a C&C address, and their Slack IDs
 *
 * @example
 *   const team = await getTeam(); // [{ id, name, slackMemberId }]
 *
 * @returns Team members, sorted by name
 */
const getTeam = async () => {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      slackMemberId: teamTaskPeople.slackMemberId,
    })
    .from(users)
    .leftJoin(teamTaskPeople, eq(teamTaskPeople.userId, users.id))
    .where(
      and(
        inArray(users.role, ['admin', 'wms_operator']),
        ilike(users.email, '%@craftculture.xyz'),
      ),
    );

  return rows.sort((a, b) => a.name.localeCompare(b.name));
};

export default getTeam;
