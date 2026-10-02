import Link from 'next/link';

import ExportInvoicesListClient from '@/app/_exportInvoices/components/ExportInvoicesListClient';
import Button from '@/app/_ui/components/Button/Button';
import Typography from '@/app/_ui/components/Typography/Typography';

/**
 * Export invoices
 *
 * Combined Commercial Invoice & Packing Lists for shipments leaving the bond,
 * built from the Zoho invoices rather than typed up by hand.
 */
const ExportInvoicesPage = () => {
  return (
    <main className="container space-y-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Typography variant="headingLg" asChild>
            <h1>Export invoices</h1>
          </Typography>
          <Typography variant="bodySm" colorRole="muted" asChild>
            <p className="mt-1 max-w-2xl">
              Commercial invoice &amp; packing list, built from the Zoho invoices going out — checked, then issued.
            </p>
          </Typography>
        </div>
        <Button colorRole="brand" asChild>
          <Link href="/platform/admin/logistics/export-invoices/new">+ New export invoice</Link>
        </Button>
      </div>
      <ExportInvoicesListClient />
    </main>
  );
};

export default ExportInvoicesPage;
