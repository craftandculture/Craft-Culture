import { redirect } from 'next/navigation';

import type { User } from '@/database/schema';
import getQueryClient from '@/lib/react-query';
import api from '@/lib/trpc/server';
import tryCatch from '@/utils/tryCatch';

export const dynamic = 'force-dynamic';

const AdminLayout = async ({ children }: React.PropsWithChildren) => {
  const queryClient = getQueryClient();

  const [userData, userError] = await tryCatch(
    queryClient.fetchQuery(api.users.getMe.queryOptions()),
  );

  if (userError || !userData) {
    redirect('/platform');
  }

  // Type assertion after validation
  const user = userData as User & { firstName: string | null; lastName: string | null };

  if (user.role !== 'admin') {
    redirect('/platform');
  }

  return children;
};

export default AdminLayout;
