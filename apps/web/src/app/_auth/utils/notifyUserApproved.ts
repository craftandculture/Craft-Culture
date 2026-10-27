import loops from '@/lib/loops/client';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

interface ApprovedUser {
  email: string;
  name: string;
}

/**
 * Send email notification to user when their account is approved
 *
 * @param user - The user who was approved
 */
const notifyUserApproved = async (user: ApprovedUser) => {
  /*
    This used to send the ADMIN "new signup awaiting approval" template
    (cmhagixdf7c3z160h3aaga4xp) to the approved user. There is no approval
    template in Loops yet, so nothing is sent until one is created and its id
    set in LOOPS_USER_APPROVED_TEMPLATE_ID.
  */
  const transactionalId = process.env.LOOPS_USER_APPROVED_TEMPLATE_ID?.trim();

  if (!transactionalId) {
    logger.info('Account approved; no approval email sent (LOOPS_USER_APPROVED_TEMPLATE_ID not set)');
    return;
  }

  try {
    const platformUrl = `${serverConfig.appUrl}/platform`;

    await loops.sendTransactionalEmail({
      transactionalId,
      email: user.email,
      dataVariables: {
        userName: user.name,
        platformUrl,
      },
    });

    logger.dev(`Sent approval notification to user: ${user.email}`);
  } catch (error) {
    logger.error(`Failed to send approval notification to ${user.email}:`, error);
  }
};

export default notifyUserApproved;
