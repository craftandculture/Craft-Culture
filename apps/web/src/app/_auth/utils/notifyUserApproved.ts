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
  try {
    const platformUrl = `${serverConfig.appUrl}/platform`;

    await loops.sendTransactionalEmail({
      transactionalId: 'user-approved', // Update with actual Loops template ID
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
