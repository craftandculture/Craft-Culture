import AdminPageHeader from '@/app/_admin/components/AdminPageHeader';
import LpoPreviewClient from '@/app/_lpo/components/LpoPreviewClient';

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
      <AdminPageHeader
        title="Client purchase orders"
        description={
          <>
            Upload an LPO to see it read back against live stock: what each line means, what we hold across every pack of that wine, which lines need a repack code Zoho does not have yet, and which take the last bottles. Nothing is written anywhere — this is the check that currently happens line by line, and at picking.
          </>
        }
      />
      <LpoPreviewClient />
    </main>
  );
};

export default LpoPage;
