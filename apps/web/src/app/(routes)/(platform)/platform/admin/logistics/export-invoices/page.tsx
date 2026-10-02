import ExportInvoicesListClient from '@/app/_exportInvoices/components/ExportInvoicesListClient';
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
      <div>
        <Typography variant="headingLg" asChild>
          <h1>Export invoices</h1>
        </Typography>
        <Typography variant="bodySm" colorRole="muted" asChild>
          <p className="mt-1 max-w-3xl">
            Choose a consignee and the invoices going out, and the commercial invoice and packing list is
            built from Zoho: net prices in AED, HS codes, origins, re-export BOEs from stock, and PCO orders
            packed in cases of three. Check it, ask for whatever customs want changed, and issue.
          </p>
        </Typography>
      </div>
      <ExportInvoicesListClient />
    </main>
  );
};

export default ExportInvoicesPage;
