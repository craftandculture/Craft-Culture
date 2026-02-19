import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import AgentDashboard from '@/app/_agents/components/AgentDashboard';
import getQueryClient from '@/lib/react-query';

/**
 * AI Agents Dashboard - Scout, Concierge, Storyteller briefs + competitor upload
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
