import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import PartnerDashboard from '@/app/_privateClientOrders/components/PartnerDashboard';
import getQueryClient from '@/lib/react-query';

/**
 * Private Client Orders page for Wine Partners
 *
 * Dashboard with KPIs, status pipeline, recent orders,
 * and top clients for the current partner.
 */
const PrivateOrdersPage = async () => {
  const queryClient = getQueryClient();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="container py-4 landscape:py-2 md:py-8">
        <PartnerDashboard />
      </main>
    </HydrationBoundary>
  );
};

export default PrivateOrdersPage;
