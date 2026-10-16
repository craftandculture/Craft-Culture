import Link from 'next/link';

import NewExportInvoiceClient from '@/app/_exportInvoices/components/NewExportInvoiceClient';
import Typography from '@/app/_ui/components/Typography/Typography';

/**
 * Start an export invoice from a consignee's invoices
 *
 * Opened from an export job (?shipmentId=…), the job's client and Zoho
 * invoice are chosen already and the draft is linked back to that job.
 */
const NewExportInvoicePage = async ({ searchParams }: { searchParams: Promise<{ shipmentId?: string }> }) => {
  const { shipmentId } = await searchParams;
  const validShipmentId = shipmentId && /^[0-9a-f-]{36}$/i.test(shipmentId) ? shipmentId : undefined;
  return (
    <main className="container space-y-6 py-8">
      <div>
        <Link href="/platform/admin/logistics/export-invoices" className="text-xs text-text-muted hover:underline">
          ← Export invoices
        </Link>
        <Typography variant="headingLg" asChild>
          <h1>New export invoice</h1>
        </Typography>
      </div>
      <NewExportInvoiceClient shipmentId={validShipmentId} />
    </main>
  );
};

export default NewExportInvoicePage;
