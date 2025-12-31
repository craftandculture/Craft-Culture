import SessionDetailView from '@/app/_pricingCalculator/components/SessionDetailView';
import getSessionOrRedirect from '@/app/_pricingCalculator/data/getSessionOrRedirect';

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

  const session = await getSessionOrRedirect(sessionId);

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <SessionDetailView session={session} />
    </main>
  );
};

export default PricingSessionPage;
