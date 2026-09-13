import { redirect } from 'next/navigation';

import { resolveAccessProfile } from '@/app/_auth/constants/accessProfiles';
import getQueryClient from '@/lib/react-query';
import api from '@/lib/trpc/server';
import tryCatch from '@/utils/tryCatch';

/**
 * The cellar is for accounts that hold wine with us
 *
 * Anyone else is sent to their own home rather than shown an empty page —
 * a screen that renders nothing reads as a fault, not as a boundary.
 */
const CellarLayout = async ({ children }: React.PropsWithChildren) => {
  const queryClient = getQueryClient();

  const [user, userError] = await tryCatch(
    queryClient.fetchQuery(api.users.getMe.queryOptions()),
  );

  if (userError) {
    redirect('/sign-in?next=/platform/cellar');
  }

  const access = resolveAccessProfile({
    role: user.role,
    customerType: user.customerType,
    partnerType: user.partner?.type,
  });

  if (!access.can.ownsStock) {
    redirect(access.home);
  }

  return <>{children}</>;
};

export default CellarLayout;
