import DistributionClient from '@/app/_distribution/components/DistributionClient';
import Typography from '@/app/_ui/components/Typography/Typography';

/**
 * Distribution
 *
 * Our wine placed with a retail outlet, and whose it is. Four positions per
 * wine: what went Out, what the outlet still Holds, what they Sold, and what
 * the owner has Billed us.
 */
const DistributionPage = () => {
  return (
    <main className="container space-y-6 py-8">
      <div>
        <Typography variant="headingLg" asChild>
          <h1>Distribution</h1>
        </Typography>
        <Typography variant="bodySm" colorRole="muted" asChild>
          <p className="mt-1">
            Wine placed with a distributor on consignment — what went out,
            what they hold, what sold, and whose it is. In bottles.
          </p>
        </Typography>
      </div>
      <DistributionClient />
    </main>
  );
};

export default DistributionPage;
