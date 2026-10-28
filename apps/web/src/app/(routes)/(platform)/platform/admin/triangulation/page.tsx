import AdminPageHeader from '@/app/_admin/components/AdminPageHeader';
import TriangulationClient from '@/app/_triangulation/components/TriangulationClient';

/**
 * Stock triangulation
 *
 * Reconciles owner stock (initially Crurated) across the two parties holding
 * it: Craft & Culture in the warehouse, and City Drinks on their website.
 */
const TriangulationPage = () => {
  return (
    <main className="container space-y-6 py-8">
      <AdminPageHeader
        title="Stock triangulation"
        description={
          <>
            Consignment stock reconciled between C&amp;C and the outlet holding it, one client at a time, in bottles.
          </>
        }
      />
      <TriangulationClient />
    </main>
  );
};

export default TriangulationPage;
