import { redirect } from 'next/navigation';

import { resolveAccessProfile } from '@/app/_auth/constants/accessProfiles';
import getQueryClient from '@/lib/react-query';
import api from '@/lib/trpc/server';
import tryCatch from '@/utils/tryCatch';

/**
 * Layout for B2C support page
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
  const access = resolveAccessProfile({
    role: user.role,
    customerType: user.customerType,
    partnerType: user.partner?.type,
  });

  const isWinePartner =
    access.can.ownsStock;

  if (isWinePartner) {
    redirect('/platform/partner/support');
  }

  // Redirect distributors to distributor support
  const isDistributor = access.can.distributorTools;

  if (isDistributor) {
    redirect('/platform/distributor/support');
  }

  return <>{children}</>;
};

export default SupportLayout;
