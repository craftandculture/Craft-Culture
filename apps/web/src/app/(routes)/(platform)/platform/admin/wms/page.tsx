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

  console.log('[WMS Page] Starting server-side prefetch...');

  // Prefetch all dashboard data in parallel
  try {
    await Promise.all([
      queryClient.prefetchQuery(api.wms.admin.stock.getOverview.queryOptions({})),
      queryClient.prefetchQuery(api.wms.admin.stock.getMovements.queryOptions({ limit: 5 })),
      queryClient.prefetchQuery(api.wms.admin.stock.getExpiring.queryOptions({ daysThreshold: 90 })),
      queryClient.prefetchQuery(
        api.wms.admin.ownership.getRequests.queryOptions({ status: 'pending', limit: 5, offset: 0 })
      ),
    ]);
    console.log('[WMS Page] Prefetch completed successfully');
  } catch (error) {
    console.error('[WMS Page] Prefetch error:', error);
  }

  // Log the dehydrated state to see what data was prefetched
  const dehydratedState = dehydrate(queryClient);
  console.log('[WMS Page] Dehydrated queries count:', dehydratedState.queries?.length);
  console.log('[WMS Page] Dehydrated state:', JSON.stringify(dehydratedState, null, 2).slice(0, 2000));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <WMSDashboardContent />
    </HydrationBoundary>
  );
};

export default WMSDashboardPage;
