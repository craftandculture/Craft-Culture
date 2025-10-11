import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import SettingInviteMember from '@/app/_settings/components/SettingInviteMember';
import SettingMembers from '@/app/_settings/components/SettingMembers';
import SettingPendingInvites from '@/app/_settings/components/SettingPendingInvites';
import getQueryClient from '@/lib/react-query';
import api from '@/lib/trpc/server';

import type { OrganizationRoute } from '../../../layout';

const Page = async ({ params }: OrganizationRoute) => {
  const { orgId } = await params;

  const queryClient = getQueryClient();

  void queryClient.prefetchQuery(
    api.organizations.members.getAll.queryOptions({
      organizationId: orgId,
    }),
  );

  void queryClient.prefetchQuery(
    api.teamInvites.getMany.queryOptions({
      organizationId: orgId,
    }),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SettingInviteMember />
      <SettingMembers />
      <SettingPendingInvites />
    </HydrationBoundary>
  );
};

export default Page;
