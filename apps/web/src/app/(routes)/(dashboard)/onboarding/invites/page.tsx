import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { redirect } from 'next/navigation';

import InvitesCard from '@/app/_onboarding/components/InvitesCard';
import getQueryClient from '@/lib/react-query';
import api from '@/lib/trpc/server';
import tryCatch from '@/utils/tryCatch';

const InvitesPage = async () => {
  const queryClient = getQueryClient();

  const [user] = await tryCatch(
    queryClient.fetchQuery(api.users.getMe.queryOptions()),
  );

  if (user?.onboardingStep !== 'invites') {
    redirect('/dashboard');
  }

  void queryClient.prefetchQuery(
    api.teamInvites.getMany.queryOptions({
      status: ['pending'],
    }),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <InvitesCard />
    </HydrationBoundary>
  );
};

export default InvitesPage;
