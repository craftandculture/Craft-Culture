import AdminPageHeader from '@/app/_admin/components/AdminPageHeader';
import DistributionClient from '@/app/_distribution/components/DistributionClient';

/**
 * Consignment & Distribution setup
 *
 * What the monthly run rests on and is kept rather than redone: the Codes tab,
 * owner costs and accounts, invoice types, one wine under several codes, every
 * wine's position, and the quarterly stock check.
 */
const DistributionSetupPage = () => {
  return (
    <main className="container space-y-6 py-8">
      <AdminPageHeader
        title="Consignment setup"
        description={
          <>
            Codes, owners, invoice types and the stock check. These feed every month&rsquo;s numbers but are set once and kept. <a className="underline" href="/platform/admin/distribution">Back to the month</a>
          </>
        }
      />
      <DistributionClient page="setup" />
    </main>
  );
};

export default DistributionSetupPage;
