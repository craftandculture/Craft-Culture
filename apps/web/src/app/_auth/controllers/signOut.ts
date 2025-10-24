import { headers } from 'next/headers';

import logAdminActivity from '@/app/_admin/utils/logAdminActivity';
import auth from '@/lib/better-auth/server';

import type { UserContext } from '../data/getUser';

/**
 * Sign out and log admin logout activity
 */
const signOutController = async ({ user }: { user: UserContext }) => {
  if (user.role === 'admin') {
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip');
    const userAgent = headersList.get('user-agent');

    await logAdminActivity({
      adminId: user.id,
      action: 'admin.logout',
      ipAddress: ipAddress ?? undefined,
      userAgent: userAgent ?? undefined,
      metadata: {
        email: user.email,
      },
    });
  }

  await auth.api.signOut({
    headers: await headers(),
  });

  return { success: true };
};

export default signOutController;
