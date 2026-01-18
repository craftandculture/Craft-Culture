import { redirect } from 'next/navigation';

import AdminSidebarWrapper from '@/app/_admin/components/AdminSidebarWrapper';
import getQueryClient from '@/lib/react-query';
import api from '@/lib/trpc/server';
import tryCatch from '@/utils/tryCatch';

export const dynamic = 'force-dynamic';

const AdminLayout = async ({ children }: React.PropsWithChildren) => {
  const queryClient = getQueryClient();

  const [user, userError] = await tryCatch(queryClient.fetchQuery(api.users.getMe.queryOptions()));

  if (userError || user.role !== 'admin') {
    redirect('/platform');
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] bg-fill-muted/20 dark:bg-background-primary">
      <AdminSidebarWrapper />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
};

export default AdminLayout;
