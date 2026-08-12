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
          <p className="mt-1">
            Crurated stock reconciled across C&amp;C and City Drinks, in bottles.
          </p>
        </Typography>
      </div>
      <TriangulationClient />
    </main>
  );
};

export default TriangulationPage;
