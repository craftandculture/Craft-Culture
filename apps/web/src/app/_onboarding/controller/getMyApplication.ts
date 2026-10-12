import { protectedProcedure } from '@/lib/trpc/procedures';

import getApplicationView from '../data/getApplicationView';
import getMembershipTerms from '../data/getMembershipTerms';
import getOrCreateApplication from '../data/getOrCreateApplication';

/**
 * The signed-in person's Private Cellar application, started if need be
 *
 * Open to anyone signed in, approved or not — applying is how an account gets
 * approved in the first place.
 */
const getMyApplication = protectedProcedure.query(async ({ ctx }) => {
  const application = await getOrCreateApplication(ctx.user.id, ctx.user.name);

  const [view, terms] = await Promise.all([
    getApplicationView(application),
    getMembershipTerms(application.partnerId),
  ]);

  return {
    ...view,
    terms,
    email: ctx.user.email,
    isApproved: ctx.user.approvalStatus === 'approved',
  };
});

export default getMyApplication;
