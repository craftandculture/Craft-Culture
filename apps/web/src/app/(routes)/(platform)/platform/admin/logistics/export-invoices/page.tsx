import Link from 'next/link';

import AdminPageHeader from '@/app/_admin/components/AdminPageHeader';
import ExportInvoicesListClient from '@/app/_exportInvoices/components/ExportInvoicesListClient';
import Button from '@/app/_ui/components/Button/Button';

/**
 * Export invoices
 *
 * Combined Commercial Invoice & Packing Lists for shipments leaving the bond,
 * built from the Zoho invoices rather than typed up by hand.
 */
const ExportInvoicesPage = () => {
  return (
    <main className="container space-y-6 py-8">
      <AdminPageHeader
        title="Export invoices"
        description="Commercial invoice & packing list, built from the Zoho invoices going out — checked, then issued."
        crumbs={[{ label: 'Logistics', href: '/platform/admin/logistics' }]}
        actions={
          <Button colorRole="brand" asChild>
            <Link href="/platform/admin/logistics/export-invoices/new">+ New export invoice</Link>
          </Button>
        }
      />
      <ExportInvoicesListClient />
    </main>
  );
};

export default ExportInvoicesPage;
