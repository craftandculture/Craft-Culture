import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import DashboardHeader from '@/app/_shared-platform/components/DashboardHeader';
import SystemMessage from '@/app/_system-messages/components/SystemMessage';
import getQueryClient from '@/lib/react-query';
import api from '@/lib/trpc/server';

export type OrganizationRoute<
  T extends Record<string, string> = Record<string, string>,
> = {
  params: Promise<T & { orgId: string }>;
};

const Layout = async ({
  params,
  children,
}: React.PropsWithChildren<OrganizationRoute>) => {
  const { orgId } = await params;

  const queryClient = getQueryClient();

  void queryClient.prefetchQuery(api.organizations.getAll.queryOptions());
  void queryClient.prefetchQuery(api.administrations.getAll.queryOptions());
  void queryClient.prefetchQuery(api.systemMessages.get.queryOptions());
  void queryClient.prefetchQuery(
    api.notifications.getMany.queryOptions({ organizationId: orgId }),
  );
  void queryClient.prefetchQuery(
    api.organizations.usage.getSummary.queryOptions({ organizationId: orgId }),
  );

  const user = await queryClient.fetchQuery(api.users.getMe.queryOptions());

  if (user?.onboardingStep !== 'completed') {
    redirect('/onboarding');
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="bg-background-muted min-w-screen relative flex min-h-screen flex-col">
        <Suspense fallback={<></>}>
          <SystemMessage />
        </Suspense>
        <DashboardHeader organizationSlug={orgId} />
        {children}
      </div>
    </HydrationBoundary>
  );
};

export default Layout;
