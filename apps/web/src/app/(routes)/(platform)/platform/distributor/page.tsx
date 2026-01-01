import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import DistributorDashboard from '@/app/_privateClientOrders/components/DistributorDashboard';
import DistributorNav from '@/app/_privateClientOrders/components/DistributorNav';
import getQueryClient from '@/lib/react-query';

/**
 * Distributor Dashboard page
 *
 * Overview of all assigned orders with KPIs, status pipeline,
 * and quick access to order management features.
 */
const DistributorDashboardPage = async () => {
  const queryClient = getQueryClient();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="container py-4 landscape:py-2 md:py-8">
        <DistributorNav />
        <div className="mt-6">
          <DistributorDashboard />
        </div>
      </main>
    </HydrationBoundary>
  );
};

export default DistributorDashboardPage;
