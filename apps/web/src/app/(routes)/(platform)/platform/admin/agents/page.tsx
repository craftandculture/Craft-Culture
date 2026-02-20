import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import AgentDashboard from '@/app/_agents/components/AgentDashboard';
import getQueryClient from '@/lib/react-query';

/**
 * Intelligence Dashboard - Scout, Concierge, Socials briefs + competitor upload
 */
const AgentsDashboardPage = async () => {
  const queryClient = getQueryClient();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AgentDashboard />
    </HydrationBoundary>
  );
};

export default AgentsDashboardPage;
