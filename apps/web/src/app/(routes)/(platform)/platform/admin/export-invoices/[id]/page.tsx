import ExportInvoiceEditor from '@/app/_exportInvoices/components/ExportInvoiceEditor';

/** Check, change and issue one export invoice */
const ExportInvoicePage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return (
    <main className="container py-8">
      <ExportInvoiceEditor id={id} />
    </main>
  );
};

export default ExportInvoicePage;
