import { redirect } from 'next/navigation';

import AdminNav from '@/app/_admin/components/AdminNav';
import getQueryClient from '@/lib/react-query';
import api from '@/lib/trpc/server';
import tryCatch from '@/utils/tryCatch';

export const dynamic = 'force-dynamic';

const AdminLayout = async ({ children }: React.PropsWithChildren) => {
  const queryClient = getQueryClient();

  const [user, userError] = await tryCatch(
    queryClient.fetchQuery(api.users.getMe.queryOptions()),
  );

  if (userError || user.role !== 'admin') {
    redirect('/platform');
  }

  return (
    <div className="min-h-screen bg-fill-muted/20 dark:bg-background-primary">
      <AdminNav />
      {children}
    </div>
  );
};

export default AdminLayout;
