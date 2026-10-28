import { redirect } from 'next/navigation';

import isTeamMember from '@/app/_teamTasks/utils/isTeamMember';
import CommandPalette from '@/app/_wms/components/CommandPalette';
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

  /*
    Staff only: an admin or warehouse role signed in with a C&C address. Some
    partners hold admin logins, and pages that read the database directly
    (rather than through a staff-gated procedure) relied on this check alone.
  */
  if (userError || !isTeamMember(user)) {
    redirect('/platform');
  }

  return (
    <>
      <CommandPalette />
      {children}
    </>
  );
};

export default AdminLayout;
