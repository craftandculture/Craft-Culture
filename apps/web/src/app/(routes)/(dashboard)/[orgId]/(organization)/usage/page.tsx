import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import UsageEntryAICard from '@/app/_usage/components/UsageEntryAICard';
import getQueryClient from '@/lib/react-query';

const Page = async () => {
  const queryClient = getQueryClient();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UsageEntryAICard />
    </HydrationBoundary>
  );
};

export default Page;
