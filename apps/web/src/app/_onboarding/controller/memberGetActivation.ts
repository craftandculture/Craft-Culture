import { stockOwnerProcedure } from '@/lib/trpc/procedures';

import getActivationState from '../data/getActivationState';
import getMembershipTerms from '../data/getMembershipTerms';

/** What "Activate your cellar" needs to show: what is missing, and the terms */
const memberGetActivation = stockOwnerProcedure.query(async ({ ctx }) => {
  const [state, terms] = await Promise.all([
    getActivationState(ctx.partner.id),
    getMembershipTerms(ctx.partner.id),
  ]);

  return {
    isGated: state.isGated,
    isActivated: state.isActivated,
    missing: state.missing,
    status: state.membership?.status ?? null,
    cardLast4: state.membership?.cardLast4 ?? null,
    documentTypes: state.documentTypes,
    eidNumber: state.eidNumber,
    terms,
  };
});

export default memberGetActivation;
