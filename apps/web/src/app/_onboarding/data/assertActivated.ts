import { TRPCError } from '@trpc/server';

import getActivationState from './getActivationState';

/** The message an unactivated action fails with — the cellar page listens for it */
export const NOT_ACTIVATED = 'NOT_ACTIVATED';

/**
 * Stop an action until the member has activated their cellar
 *
 * Called first in every action that moves or commits wine: buying, releasing,
 * offering for sale, bringing wine in. Looking around is never gated. The
 * page catches the error and opens "Activate your cellar" in place.
 *
 * @param partnerId - The member's cellar
 */
const assertActivated = async (partnerId: string) => {
  const state = await getActivationState(partnerId);

  if (!state.isActivated) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: `${NOT_ACTIVATED}:${state.missing.join(',')}`,
    });
  }
};

export default assertActivated;
