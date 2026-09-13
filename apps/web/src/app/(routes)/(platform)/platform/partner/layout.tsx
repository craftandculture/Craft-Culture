import { redirect } from 'next/navigation';

import { resolveAccessProfile } from '@/app/_auth/constants/accessProfiles';
import getQueryClient from '@/lib/react-query';
import api from '@/lib/trpc/server';
import tryCatch from '@/utils/tryCatch';

/**
 * Layout for partner-only routes
 * Restricts access to wine partner users only
 */
const PartnerLayout = async ({ children }: React.PropsWithChildren) => {
  const queryClient = getQueryClient();

  const [user, userError] = await tryCatch(
    queryClient.fetchQuery(api.users.getMe.queryOptions()),
  );

  if (userError) {
    redirect('/sign-in?next=/platform/partner/support');
  }

  // Only allow wine partners to access partner routes
  const isWinePartner =
    resolveAccessProfile({
      role: user.role,
      customerType: user.customerType,
      partnerType: user.partner?.type,
    }).can.ownsStock;

  if (!isWinePartner) {
    redirect('/platform');
  }

  return <>{children}</>;
};

export default PartnerLayout;
