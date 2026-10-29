import AdminPageHeader from '@/app/_admin/components/AdminPageHeader';
import DistributionClient from '@/app/_distribution/components/DistributionClient';

/**
 * Consignment & Distribution
 *
 * Our wine placed with a retail outlet, and whose it is. Four positions per
 * wine: what went Out, what the outlet still Holds, what they Sold, and what
 * the owner has Billed us.
 */
const DistributionPage = () => {
  return (
    <main className="container space-y-6 py-8">
      <AdminPageHeader
        title="Consignment & Distribution"
        description={
          <>
            Wine placed with a distributor — what went out, what they hold, what sold, and whose it is. In bottles. A line they take onto their own book stops counting as consignment.
          </>
        }
      />
      <DistributionClient />
    </main>
  );
};

export default DistributionPage;
