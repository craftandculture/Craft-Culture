import LpoPreviewClient from '@/app/_lpo/components/LpoPreviewClient';
import Typography from '@/app/_ui/components/Typography/Typography';

/**
 * Client purchase orders
 *
 * Reads an LPO PDF and says what fulfilling it would take — which wines the
 * client means, whether we hold them, which lines are repacks and which item
 * codes Zoho does not have — before any of it is keyed.
 */
const LpoPage = () => {
  return (
    <main className="container space-y-6 py-8">
      <div>
        <Typography variant="headingLg" asChild>
          <h1>Client purchase orders</h1>
        </Typography>
        <Typography variant="bodySm" colorRole="muted" asChild>
          <p className="mt-1 max-w-3xl">
            Upload an LPO to see it read back against live stock: what each line
            means, what we hold across every pack of that wine, which lines need
            a repack code Zoho does not have yet, and which take the last
            bottles. Nothing is written anywhere — this is the check that
            currently happens line by line, and at picking.
          </p>
        </Typography>
      </div>
      <LpoPreviewClient />
    </main>
  );
};

export default LpoPage;
