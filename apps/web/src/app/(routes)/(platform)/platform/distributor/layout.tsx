import { redirect } from 'next/navigation';

import getQueryClient from '@/lib/react-query';
import api from '@/lib/trpc/server';
import tryCatch from '@/utils/tryCatch';

/**
 * Layout for distributor-only routes
 * Restricts access to distributor users only
 */
const DistributorLayout = async ({ children }: React.PropsWithChildren) => {
  const queryClient = getQueryClient();

  const [user, userError] = await tryCatch(
    queryClient.fetchQuery(api.users.getMe.queryOptions()),
  );

  if (userError) {
    redirect('/sign-in?next=/platform/distributor/support');
  }

  // Allow distributors (b2b customer type or distributor partner type)
  const isDistributor = user.customerType === 'b2b' || user.partner?.type === 'distributor';

  if (!isDistributor) {
    redirect('/platform');
  }

  return <>{children}</>;
};

export default DistributorLayout;
