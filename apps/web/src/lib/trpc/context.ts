import { TRPCError } from '@trpc/server';

import getCurrentUser from '@/app/_auth/data/getCurrentUser';

/**
 * Creates the tRPC context with user and access control function
 *
 * @returns Context object with user and accessControl helper
 */
const createTRPCContext = async () => {
  const user = await getCurrentUser();

  /**
   * Access control helper function to check permissions
   *
   * @param checkFn - Function that returns true if access is granted
   * @throws {TRPCError} FORBIDDEN if access check fails
   */
  const accessControl = (checkFn: () => boolean) => {
    if (!checkFn()) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this resource',
      });
    }
  };

  return {
    user,
    accessControl,
  };
};

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

export default createTRPCContext;
