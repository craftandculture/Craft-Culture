import { redirect } from 'next/navigation';

import getCurrentUser from '@/app/_auth/data/getCurrentUser';
import resolvePartnerForUser from '@/app/_partners/data/resolvePartnerForUser';
import tryCatch from '@/utils/tryCatch';

export const GET = async () => {
  const [user] = await tryCatch(getCurrentUser());

  // Admins and operators have their own homes
  if (user?.role === 'admin') {
    return redirect('/platform/admin/home');
  }

  if (user?.role === 'wms_operator') {
    return redirect('/platform/admin/wms');
  }

  /*
    Stock owners land on their inventory.

    This used to test `user.partnerId`, which assignment deliberately clears —
    partnerMembers is the source of truth — so anyone linked the modern way fell
    through to the quotes screen, which is not theirs to use.
  */
  if (user?.customerType === 'private_clients') {
    const partner = await resolvePartnerForUser(
      user.id,
      ['wine_partner', 'private_collector'],
      user.partnerId,
    );

    if (partner) {
      return redirect('/platform/partner/stock');
    }
  }

  return redirect('/platform/quotes');
};
