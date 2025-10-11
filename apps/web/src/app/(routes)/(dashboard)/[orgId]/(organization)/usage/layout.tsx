import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import Typography from '@/app/_ui/components/Typography/Typography';
import UsagePageSettings from '@/app/_usage/components/UsagePageSettings';
import UsageSideMenu from '@/app/_usage/components/UsageSideMenu';
import getQueryClient from '@/lib/react-query';
import api from '@/lib/trpc/server';

import type { OrganizationRoute } from '../../layout';

const Layout = async ({
  params,
  children,
}: React.PropsWithChildren<OrganizationRoute>) => {
  const { orgId } = await params;

  const queryClient = getQueryClient();

  void queryClient.prefetchQuery(
    api.organizations.plan.get.queryOptions({
      organizationId: orgId,
    }),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="container my-6 space-y-6 md:mb-12 md:mt-10 md:space-y-12">
        <div className="flex max-w-full items-center justify-between gap-3 md:items-end">
          <Typography variant="headingLg" asChild>
            <h1>Gebruik</h1>
          </Typography>
          <UsagePageSettings />
        </div>
        <div className="relative flex w-full grow flex-col gap-6 overflow-y-scroll md:flex-row md:items-start">
          <UsageSideMenu />
          <div className="flex grow flex-col gap-6 md:w-full">{children}</div>
        </div>
      </main>
    </HydrationBoundary>
  );
};

export default Layout;
