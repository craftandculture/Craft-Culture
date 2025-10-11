import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { redirect } from 'next/navigation';

import ProfileCard from '@/app/_onboarding/components/ProfileCard';
import getQueryClient from '@/lib/react-query';
import api from '@/lib/trpc/server';
import tryCatch from '@/utils/tryCatch';

const ProfilePage = async () => {
  const queryClient = getQueryClient();

  const [user] = await tryCatch(
    queryClient.fetchQuery(api.users.getMe.queryOptions()),
  );

  if (user?.onboardingStep !== 'profile') {
    redirect('/dashboard');
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProfileCard />
    </HydrationBoundary>
  );
};

export default ProfilePage;
