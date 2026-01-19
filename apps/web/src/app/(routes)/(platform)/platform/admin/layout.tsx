import { redirect } from 'next/navigation';

import getQueryClient from '@/lib/react-query';
import api from '@/lib/trpc/server';
import tryCatch from '@/utils/tryCatch';

export const dynamic = 'force-dynamic';

/**
 * Admin layout - sidebar is now in the parent (platform) layout
 * This layout only handles admin auth check
 */
const AdminLayout = async ({ children }: React.PropsWithChildren) => {
  const queryClient = getQueryClient();

  const [user, userError] = await tryCatch(queryClient.fetchQuery(api.users.getMe.queryOptions()));

  if (userError || user.role !== 'admin') {
    redirect('/platform');
  }

  return <>{children}</>;
};

export default AdminLayout;
