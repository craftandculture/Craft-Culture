import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import getQueryClient from '@/lib/react-query';

import WMSDashboardContent from './WMSDashboardContent';

/**
 * WMS Dashboard - overview of warehouse locations, stock, and quick actions
 */
const WMSDashboardPage = async () => {
  const queryClient = getQueryClient();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <WMSDashboardContent />
    </HydrationBoundary>
  );
};

export default WMSDashboardPage;
