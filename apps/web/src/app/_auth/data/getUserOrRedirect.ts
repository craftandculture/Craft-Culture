import { redirect } from 'next/navigation';

import logger from '@/lib/logger';
import tryCatch from '@/utils/tryCatch';

import getCurrentUser from './getCurrentUser';

const getUserOrRedirect = async (next?: string) => {
  const [user, userError] = await tryCatch(getCurrentUser());

  if (userError) {
    logger.error('Error getting current user', { userError });
  }

  if (userError || !user) {
    redirect(`/sign-in${next ? `?${next}` : ''}`);
  }

  return user;
};

export default getUserOrRedirect;
