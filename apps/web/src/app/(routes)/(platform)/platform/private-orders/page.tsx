import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import PrivateOrdersList from '@/app/_privateClientOrders/components/PrivateOrdersList';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import CardDescription from '@/app/_ui/components/Card/CardDescription';
import CardTitle from '@/app/_ui/components/Card/CardTitle';
import getQueryClient from '@/lib/react-query';

/**
 * Private Client Orders page for Wine Partners
 *
 * Lists all orders created by the current partner with
 * search, filter, and management capabilities.
 */
const PrivateOrdersPage = async () => {
  const queryClient = getQueryClient();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="container py-4 landscape:py-2 md:py-16">
        <Card className="w-full">
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <CardTitle>Private Client Orders</CardTitle>
              <CardDescription>
                Create and manage orders for your private clients
              </CardDescription>
            </div>
            <PrivateOrdersList />
          </CardContent>
        </Card>
      </main>
    </HydrationBoundary>
  );
};

export default PrivateOrdersPage;
