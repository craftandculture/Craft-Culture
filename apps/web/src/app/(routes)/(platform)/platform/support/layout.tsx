import { redirect } from 'next/navigation';

import getQueryClient from '@/lib/react-query';
import api from '@/lib/trpc/server';
import tryCatch from '@/utils/tryCatch';

/**
 * Layout for Pocket Cellar support page
 * Redirects partners and distributors to their respective support pages
 */
const SupportLayout = async ({ children }: React.PropsWithChildren) => {
  const queryClient = getQueryClient();

  const [user, userError] = await tryCatch(
    queryClient.fetchQuery(api.users.getMe.queryOptions()),
  );

  if (userError) {
    redirect('/sign-in?next=/platform/support');
  }

  // Redirect wine partners to partner support
  const isWinePartner =
    user.customerType === 'private_clients' && user.partner?.type === 'wine_partner';

  if (isWinePartner) {
    redirect('/platform/partner/support');
  }

  // Redirect distributors to distributor support
  const isDistributor = user.customerType === 'b2b' || user.partner?.type === 'distributor';

  if (isDistributor) {
    redirect('/platform/distributor/support');
  }

  return <>{children}</>;
};

export default SupportLayout;
