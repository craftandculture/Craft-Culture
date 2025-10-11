import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import PoliciesOverview from '@/app/_policies/components/PoliciesOverview';
import getQueryClient from '@/lib/react-query';
import api from '@/lib/trpc/server';

import type { OrganizationRoute } from '../../layout';

const Page = async ({ params }: OrganizationRoute) => {
  const { orgId } = await params;

  const queryClient = getQueryClient();

  void queryClient.prefetchQuery(
    api.policies.getMany.queryOptions({
      organizationId: orgId,
    }),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="container space-y-12 py-6">
        <PoliciesOverview />
      </main>
    </HydrationBoundary>
  );
};

export default Page;
