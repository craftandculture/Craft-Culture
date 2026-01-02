import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import AdminDashboard from '@/app/_admin/components/AdminDashboard';
import getQueryClient from '@/lib/react-query';

/**
 * Admin Dashboard page
 *
 * Overview of all private client orders with KPIs, status pipeline,
 * and quick access to order management features.
 */
const AdminDashboardPage = async () => {
  const queryClient = getQueryClient();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="container py-4 landscape:py-2 md:py-8">
        <AdminDashboard />
      </main>
    </HydrationBoundary>
  );
};

export default AdminDashboardPage;
