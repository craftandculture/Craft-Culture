import { stockOwnerProcedure } from '@/lib/trpc/procedures';
import serverConfig from '@/server.config';

import getActivationState from '../data/getActivationState';
import getMembershipTerms from '../data/getMembershipTerms';
import getTermsAcceptance from '../data/getTermsAcceptance';

/** What "Activate your cellar" needs to show: what is missing, and the terms */
const memberGetActivation = stockOwnerProcedure.query(async ({ ctx }) => {
  const [state, terms, acceptance] = await Promise.all([
    getActivationState(ctx.partner.id),
    getMembershipTerms(ctx.partner.id),
    getTermsAcceptance(ctx.partner.id),
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
    /** Accepted when opening the cellar; activation then only confirms the fee */
    hasAcceptedTerms: acceptance.acceptedCurrent,
    /** 'invoice': billed through Zoho Books; 'card': Zoho Billing's payment page */
    billingMode: serverConfig.cellarBillingMode,
  };
});

export default memberGetActivation;
