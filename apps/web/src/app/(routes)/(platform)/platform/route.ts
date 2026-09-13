import { redirect } from 'next/navigation';

import { STOCK_OWNER_PARTNER_TYPES, resolveAccessProfile } from '@/app/_auth/constants/accessProfiles';
import getCurrentUser from '@/app/_auth/data/getCurrentUser';
import resolvePartnerForUser from '@/app/_partners/data/resolvePartnerForUser';
import tryCatch from '@/utils/tryCatch';

export const GET = async () => {
  const [user] = await tryCatch(getCurrentUser());

  /*
    The partner has to be resolved before the profile can be, because a
    stock owner is only distinguishable from a sales account by what they are
    linked to. This used to test `user.partnerId` — which assignment clears on
    purpose, partnerMembers being the source of truth — so anyone linked the
    modern way was sent to the quotes screen instead of their own stock.
  */
  const partner =
    user?.customerType === 'private_clients'
      ? await resolvePartnerForUser(
          user.id,
          [...STOCK_OWNER_PARTNER_TYPES],
          user.partnerId,
        )
      : null;

  const access = resolveAccessProfile({
    role: user?.role,
    customerType: user?.customerType,
    partnerType: partner?.type,
  });

  return redirect(access.home);
};
