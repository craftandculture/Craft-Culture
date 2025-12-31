import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import DistributorOrdersList from '@/app/_privateClientOrders/components/DistributorOrdersList';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import CardDescription from '@/app/_ui/components/Card/CardDescription';
import CardTitle from '@/app/_ui/components/Card/CardTitle';
import getQueryClient from '@/lib/react-query';

/**
 * Distributor Orders page
 *
 * Lists all orders assigned to the current distributor with
 * search, status tracking, and action capabilities.
 */
const DistributorOrdersPage = async () => {
  const queryClient = getQueryClient();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="container py-4 landscape:py-2 md:py-16">
        <Card className="w-full">
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <CardTitle>Assigned Orders</CardTitle>
              <CardDescription>
                Manage orders assigned to you for fulfillment and delivery
              </CardDescription>
            </div>
            <DistributorOrdersList />
          </CardContent>
        </Card>
      </main>
    </HydrationBoundary>
  );
};

export default DistributorOrdersPage;
