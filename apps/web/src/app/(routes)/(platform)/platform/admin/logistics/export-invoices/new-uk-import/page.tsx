import AdminPageHeader from '@/app/_admin/components/AdminPageHeader';
import NewUkImportClient from '@/app/_exportInvoices/components/NewUkImportClient';

/**
 * Start a UK import invoice from the supplier's documents
 *
 * For wine C&C ships out of a UK bond (LCB, BBR…) on its own UK EORI to
 * C&C FZE: the commercial invoice & packing list customs need, stamped.
 */
const NewUkImportPage = () => (
  <main className="container space-y-6 py-8">
    <AdminPageHeader
      title="New UK import"
      description="Upload the supplier invoices, screenshots or Excel list. The lines are read for you, then checked here before issuing."
      crumbs={[
        { label: 'Logistics', href: '/platform/admin/logistics' },
        { label: 'Export invoices', href: '/platform/admin/logistics/export-invoices' },
      ]}
    />
    <NewUkImportClient />
  </main>
);

export default NewUkImportPage;
