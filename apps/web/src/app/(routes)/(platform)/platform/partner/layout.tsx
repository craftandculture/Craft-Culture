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

  const access = resolveAccessProfile({
    role: user.role,
    customerType: user.customerType,
    partnerType: user.partner?.type,
  });

  /*
    Only a wine partner, the same rule as winePartnerProcedure. Owning stock
    is not enough: a private collector owns stock too, passed this gate, and
    then met FORBIDDEN on every query. A collector following an old link lands
    in their cellar instead.
  */
  if (access.kind === 'collector') {
    redirect(access.home);
  }

  if (access.kind !== 'wine_partner') {
    redirect('/platform');
  }

  return <>{children}</>;
};

export default PartnerLayout;
