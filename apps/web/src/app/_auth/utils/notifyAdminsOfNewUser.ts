import db from '@/database/client';
import loops from '@/lib/loops/client';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

interface NewUser {
  id: string;
  email: string;
  name: string;
  customerType: string;
  createdAt: Date;
}

/**
 * Notify all admin users via email when a new user signs up and needs approval
 *
 * @param user - The new user who signed up
 */
const notifyAdminsOfNewUser = async (user: NewUser) => {
  try {
    // Query all admin users
    const adminUsers = await db.query.users.findMany({
      where: (users, { eq }) => eq(users.role, 'admin'),
      columns: {
        email: true,
        name: true,
      },
    });

    if (adminUsers.length === 0) {
      logger.warn('No admin users found to notify of new user signup');
      return;
    }

    const adminUrl = `${serverConfig.appUrl}/platform/admin/users?filter=pending`;

    // Send email to each admin
    const emailPromises = adminUsers.map(async (admin) => {
      try {
        await loops.sendTransactionalEmail({
          transactionalId: 'new-user-approval-needed', // Update with actual Loops template ID
          email: admin.email,
          dataVariables: {
            adminName: admin.name,
            userName: user.name,
            userEmail: user.email,
            customerType: user.customerType === 'b2b' ? 'Distributor (B2B)' : 'Sales Person (B2C)',
            signupDate: user.createdAt.toLocaleDateString(),
            adminUrl,
          },
        });

        logger.info(`Sent new user approval notification to admin: ${admin.email}`);
      } catch (error) {
        logger.error(`Failed to send notification to admin ${admin.email}:`, error);
      }
    });

    await Promise.allSettled(emailPromises);
  } catch (error) {
    logger.error('Failed to notify admins of new user:', error);
  }
};

export default notifyAdminsOfNewUser;
