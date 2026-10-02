import NewExportInvoiceClient from '@/app/_exportInvoices/components/NewExportInvoiceClient';
import Typography from '@/app/_ui/components/Typography/Typography';

/** Start an export invoice from a consignee's invoices */
const NewExportInvoicePage = () => {
  return (
    <main className="container space-y-6 py-8">
      <Typography variant="headingLg" asChild>
        <h1>New export invoice</h1>
      </Typography>
      <NewExportInvoiceClient />
    </main>
  );
};

export default NewExportInvoicePage;
