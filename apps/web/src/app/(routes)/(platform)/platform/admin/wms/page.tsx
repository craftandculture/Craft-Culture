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

  // Use fetchQuery for overview to see errors (unlike prefetchQuery which swallows them)
  try {
    const overviewData = await queryClient.fetchQuery(api.wms.admin.stock.getOverview.queryOptions({}));
    console.log('[WMS Page] Overview fetch SUCCESS:', JSON.stringify(overviewData).slice(0, 500));
  } catch (error) {
    console.error('[WMS Page] Overview fetch FAILED:', error);
  }

  // Prefetch other data in parallel
  try {
    await Promise.all([
      queryClient.prefetchQuery(api.wms.admin.stock.getMovements.queryOptions({ limit: 5 })),
      queryClient.prefetchQuery(api.wms.admin.stock.getExpiring.queryOptions({ daysThreshold: 90 })),
      queryClient.prefetchQuery(
        api.wms.admin.ownership.getRequests.queryOptions({ status: 'pending', limit: 5, offset: 0 })
      ),
    ]);
    console.log('[WMS Page] Other prefetches completed successfully');
  } catch (error) {
    console.error('[WMS Page] Other prefetch error:', error);
  }

  // Log the dehydrated state to see what data was prefetched
  const dehydratedState = dehydrate(queryClient);
  console.log('[WMS Page] Dehydrated queries count:', dehydratedState.queries?.length);
  // Log each query's key and data
  dehydratedState.queries?.forEach((q) => {
    console.log('[WMS Page] Query:', JSON.stringify(q.queryKey), 'State:', q.state.status);
    if (q.state.data) {
      console.log('[WMS Page] Data preview:', JSON.stringify(q.state.data).slice(0, 500));
    }
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <WMSDashboardContent />
    </HydrationBoundary>
  );
};

export default WMSDashboardPage;
