import TriangulationClient from '@/app/_triangulation/components/TriangulationClient';
import Typography from '@/app/_ui/components/Typography/Typography';

/**
 * Stock triangulation
 *
 * Reconciles owner stock (initially Crurated) across the two parties holding
 * it: Craft & Culture in the warehouse, and City Drinks on their website.
 */
const TriangulationPage = () => {
  return (
    <main className="container space-y-6 py-8">
      <div>
        <Typography variant="headingLg" asChild>
          <h1>Stock triangulation</h1>
        </Typography>
        <Typography variant="bodySm" colorRole="muted" asChild>
          <p className="mt-1 max-w-3xl">
            Reconciles Crurated stock across both parties holding it. Two chains
            are calculated from the monthly inputs, in bottles —{' '}
            <strong>C&amp;C on hand</strong> = received into C&amp;C less
            invoiced to City Drinks, and <strong>City Drinks on hand</strong> =
            invoiced to them less sold to consumers — and each is checked against
            the physical count that side declared.
          </p>
        </Typography>
      </div>
      <TriangulationClient />
    </main>
  );
};

export default TriangulationPage;
