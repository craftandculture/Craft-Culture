import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import QuotesList from '@/app/_quotes/components/QuotesList';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import CardDescription from '@/app/_ui/components/Card/CardDescription';
import CardTitle from '@/app/_ui/components/Card/CardTitle';
import getQueryClient from '@/lib/react-query';
import api from '@/lib/trpc/server';

const MyQuotesPage = async () => {
  const queryClient = getQueryClient();

  // Prefetch initial quotes data
  void queryClient.prefetchQuery(
    api.quotes.getMany.queryOptions({
      limit: 20,
      cursor: 0,
    }),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="container py-4 landscape:py-2 md:py-16">
        <Card className="w-full">
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <CardTitle>My Quotes</CardTitle>
              <CardDescription>
                View and manage all your saved quotes
              </CardDescription>
            </div>
            <QuotesList />
          </CardContent>
        </Card>
      </main>
    </HydrationBoundary>
  );
};

export default MyQuotesPage;
