import { redirect } from 'next/navigation';

import getCurrentUser from '@/app/_auth/data/getCurrentUser';
import tryCatch from '@/utils/tryCatch';

export const GET = async () => {
  const [user] = await tryCatch(getCurrentUser());

  // Wine partners land on their Local Stock page
  if (user?.customerType === 'private_clients' && user.partnerId) {
    return redirect('/platform/partner/stock');
  }

  // Admins go to admin home
  if (user?.role === 'admin') {
    return redirect('/platform/admin/home');
  }

  return redirect('/platform/quotes');
};
