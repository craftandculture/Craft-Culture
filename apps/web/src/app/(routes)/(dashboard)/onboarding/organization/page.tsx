import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { redirect } from 'next/navigation';

import OrganizationCard from '@/app/_onboarding/components/OrganizationCard';
import getQueryClient from '@/lib/react-query';
import api from '@/lib/trpc/server';
import tryCatch from '@/utils/tryCatch';

const InvitesPage = async () => {
  const queryClient = getQueryClient();

  const [user] = await tryCatch(
    queryClient.fetchQuery(api.users.getMe.queryOptions()),
  );

  if (user?.onboardingStep !== 'organization') {
    redirect('/dashboard');
  }

  void queryClient.prefetchQuery(api.organizations.getAll.queryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OrganizationCard />
    </HydrationBoundary>
  );
};

export default InvitesPage;
