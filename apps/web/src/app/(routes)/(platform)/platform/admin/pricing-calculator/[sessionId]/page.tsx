import { redirect } from 'next/navigation';

import SessionDetailView from '@/app/_pricingCalculator/components/SessionDetailView';
import { serverClient } from '@/lib/trpc/server';

interface PageProps {
  params: Promise<{
    sessionId: string;
  }>;
}

/**
 * Pricing session detail page
 *
 * Shows session details, variable configuration, and price preview
 */
const PricingSessionPage = async ({ params }: PageProps) => {
  const { sessionId } = await params;

  const session = await serverClient.pricingCalc.session.getOne({ id: sessionId }).catch(() => null);

  if (!session) {
    redirect('/platform/admin/pricing-calculator');
  }

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <SessionDetailView session={session} />
    </main>
  );
};

export default PricingSessionPage;
