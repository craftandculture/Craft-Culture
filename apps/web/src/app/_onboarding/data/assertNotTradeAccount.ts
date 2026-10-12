import { TRPCError } from '@trpc/server';

import findTradeAccount from './findTradeAccount';

/**
 * Refuse a Private Cellar change for an email that holds a business account
 *
 * @param userId - The signed-in user
 */
const assertNotTradeAccount = async (userId: string) => {
  const business = await findTradeAccount(userId);

  if (business) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `This email is already used for the ${business} business account. Please use a different email address for your Private Cellar.`,
    });
  }
};

export default assertNotTradeAccount;
