import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import CardDescription from '@/app/_ui/components/Card/CardDescription';
import CardTitle from '@/app/_ui/components/Card/CardTitle';
import getQueryClient from '@/lib/react-query';
import api from '@/lib/trpc/server';

import CompanyProfileSection from './components/CompanyProfileSection';

/**
 * Settings page for managing user profile and company information
 */
const SettingsPage = async () => {
  const queryClient = getQueryClient();

  // Prefetch settings data
  void queryClient.prefetchQuery(api.settings.get.queryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="container py-4 landscape:py-2 md:py-16">
        <Card className="w-full">
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <CardTitle>Settings</CardTitle>
              <CardDescription>
                Manage your account and company preferences
              </CardDescription>
            </div>

            {/* Company Profile Section */}
            <CompanyProfileSection />
          </CardContent>
        </Card>
      </main>
    </HydrationBoundary>
  );
};

export default SettingsPage;
