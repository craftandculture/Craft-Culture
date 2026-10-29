import AdminPageHeader from '@/app/_admin/components/AdminPageHeader';
import NewExportInvoiceClient from '@/app/_exportInvoices/components/NewExportInvoiceClient';

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
      <AdminPageHeader
        title="New export invoice"
        crumbs={[
          { label: 'Logistics', href: '/platform/admin/logistics' },
          { label: 'Export invoices', href: '/platform/admin/logistics/export-invoices' },
        ]}
      />
      <NewExportInvoiceClient shipmentId={validShipmentId} />
    </main>
  );
};

export default NewExportInvoicePage;
