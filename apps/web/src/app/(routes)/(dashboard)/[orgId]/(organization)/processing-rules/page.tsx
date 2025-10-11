import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import ProcessingRulesOverview from '@/app/_processing-rules_/components/ProcessingRulesOverview';
import getQueryClient from '@/lib/react-query';
import api from '@/lib/trpc/server';

import type { OrganizationRoute } from '../../layout';

const Page = async ({ params }: OrganizationRoute) => {
  const { orgId } = await params;

  const queryClient = getQueryClient();

  void queryClient.prefetchQuery(
    api.processingRules_.getMany.queryOptions({
      organizationId: orgId,
    }),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="container space-y-12 py-6">
        <ProcessingRulesOverview />
      </main>
    </HydrationBoundary>
  );
};

export default Page;
