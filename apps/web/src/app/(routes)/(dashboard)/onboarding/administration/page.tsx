import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { redirect } from 'next/navigation';

import AdministrationCard from '@/app/_onboarding/components/AdministrationCard';
import getQueryClient from '@/lib/react-query';
import api from '@/lib/trpc/server';
import tryCatch from '@/utils/tryCatch';

const InvitesPage = async () => {
  const queryClient = getQueryClient();

  const [user] = await tryCatch(
    queryClient.fetchQuery(api.users.getMe.queryOptions()),
  );

  if (user?.onboardingStep !== 'administration') {
    redirect('/dashboard');
  }

  void queryClient.prefetchQuery(api.organizations.getAll.queryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AdministrationCard />
    </HydrationBoundary>
  );
};

export default InvitesPage;
