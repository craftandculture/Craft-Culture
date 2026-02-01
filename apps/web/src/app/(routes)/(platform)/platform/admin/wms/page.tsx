import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import getQueryClient from '@/lib/react-query';
import api from '@/lib/trpc/server';

import WMSDashboardContent from './WMSDashboardContent';

/**
 * WMS Dashboard - overview of warehouse locations, stock, and quick actions
 * Prefetches all data server-side for instant loading
 */
const WMSDashboardPage = async () => {
  const queryClient = getQueryClient();

  // Prefetch all dashboard data in parallel
  await Promise.all([
    queryClient.prefetchQuery(api.wms.admin.stock.getOverview.queryOptions({})),
    queryClient.prefetchQuery(api.wms.admin.stock.getMovements.queryOptions({ limit: 5 })),
    queryClient.prefetchQuery(api.wms.admin.stock.getExpiring.queryOptions({ daysThreshold: 90 })),
    queryClient.prefetchQuery(
      api.wms.admin.ownership.getRequests.queryOptions({ status: 'pending', limit: 5, offset: 0 })
    ),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <WMSDashboardContent />
    </HydrationBoundary>
  );
};

export default WMSDashboardPage;
