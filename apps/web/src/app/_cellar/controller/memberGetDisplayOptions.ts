import getCurrentUser from '@/app/_auth/data/getCurrentUser';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

import getBottleWordingMode from '../data/getBottleWordingMode';

const isStaffEmail = (email: string | null | undefined) =>
  !!email && email.toLowerCase().endsWith('@craftculture.xyz');

/**
 * How the cellar should read for whoever is looking at it
 *
 * The bottles-not-cases wording is shown to C&C staff first: a staff login, or
 * a member's cellar opened by staff through impersonation. Members see it only
 * once the switch is live, so nothing new reaches a client unchecked.
 *
 * @example
 *   const { bottleWording } = await trpcClient.cellar.member.getDisplayOptions.query();
 */
const memberGetDisplayOptions = stockOwnerProcedure.query(async ({ ctx }) => {
  const mode = await getBottleWordingMode();
  if (mode === 'live') return { bottleWording: true };
  if (mode === 'off') return { bottleWording: false };

  const current = await getCurrentUser().catch(() => null);
  const staff =
    isStaffEmail(ctx.user.email) ||
    isStaffEmail(current?.impersonatingAdmin?.email) ||
    !!current?.isImpersonated;

  return { bottleWording: staff };
});

export default memberGetDisplayOptions;
