import getTeam from '@/app/_teamTasks/data/getTeam';
import personName from '@/app/_teamTasks/utils/personName';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * The C&C team, for choosing who owns a shipment's next action
 *
 * The same people Team Tasks offers, so an owner here is someone who can be
 * tagged there.
 */
const adminGetTeam = adminProcedure.query(async ({ ctx }) => {
  const team = await getTeam();
  return {
    viewerId: ctx.user.id,
    team: team.map((m) => ({ id: m.id, name: personName(m.name) })),
  };
});

export default adminGetTeam;
