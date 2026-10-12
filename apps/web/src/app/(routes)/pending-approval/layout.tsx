import { redirect } from 'next/navigation';
import type { PropsWithChildren } from 'react';

import getCurrentUser from '@/app/_auth/data/getCurrentUser';
import getCellarApplicationRoute from '@/app/_onboarding/data/getCellarApplicationRoute';

/** A Private Cellar applicant waits on their own status page, not this one */
const PendingApprovalLayout = async ({ children }: PropsWithChildren) => {
  const user = await getCurrentUser();

  if (user && user.approvalStatus !== 'approved') {
    const route = await getCellarApplicationRoute(user.id);
    if (route) redirect(route);
  }

  return children;
};

export default PendingApprovalLayout;
