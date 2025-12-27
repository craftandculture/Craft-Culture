import { eq } from 'drizzle-orm';

import createAdminNotifications from '@/app/_notifications/utils/createAdminNotifications';
import db from '@/database/client';
import { users } from '@/database/schema';
import loops from '@/lib/loops/client';
import twilioClient from '@/lib/twilio/client';
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
    const adminUsers = await db
      .select({
        email: users.email,
        name: users.name,
      })
      .from(users)
      .where(eq(users.role, 'admin'));

    if (adminUsers.length === 0) {
      logger.warn('No admin users found to notify of new user signup');
      return;
    }

    const adminUrl = `${serverConfig.appUrl}/platform/admin/users?filter=pending`;

    // Send email to each admin
    const emailPromises = adminUsers.map(async (admin) => {
      try {
        await loops.sendTransactionalEmail({
          transactionalId: 'cmhagixdf7c3z160h3aaga4xp',
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

        logger.dev(`Sent new user approval notification to admin: ${admin.email}`);
      } catch (error) {
        logger.error(`Failed to send notification to admin ${admin.email}:`, error);
      }
    });

    await Promise.allSettled(emailPromises);

    // Create in-app notifications for admins (triggers bell + sound)
    try {
      await createAdminNotifications({
        type: 'new_user_pending',
        title: 'New User Signup',
        message: `${user.name} (${user.customerType === 'b2b' ? 'B2B' : 'B2C'}) is awaiting approval`,
        entityType: 'user',
        entityId: user.id,
        actionUrl: adminUrl,
      });
      logger.dev('Created in-app notifications for new user signup');
    } catch (error) {
      logger.error('Failed to create in-app notifications:', error);
    }

    // Send SMS notification if Twilio is configured
    if (twilioClient && serverConfig.adminPhoneNumber && serverConfig.twilioPhoneNumber) {
      try {
        await twilioClient.messages.create({
          body: `🔔 New user signup!\n\n${user.name} (${user.customerType === 'b2b' ? 'B2B' : 'B2C'})\n${user.email}\n\nReview: ${adminUrl}`,
          from: serverConfig.twilioPhoneNumber,
          to: serverConfig.adminPhoneNumber,
        });

        logger.dev('Sent SMS notification to admin phone');
      } catch (error) {
        logger.error('Failed to send SMS notification:', error);
      }
    }
  } catch (error) {
    logger.error('Failed to notify admins of new user:', error);
  }
};

export default notifyAdminsOfNewUser;
