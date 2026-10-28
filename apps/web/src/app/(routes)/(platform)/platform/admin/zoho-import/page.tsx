import AdminPageHeader from '@/app/_admin/components/AdminPageHeader';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import ZohoImportClient from '@/app/_zohoImport/components/ZohoImportClient';

/**
 * Admin page for Zoho Inventory Import tool
 *
 * Allows admins to upload supplier invoices, extract wine items,
 * and generate Zoho-compatible CSV files for bulk import.
 */
const ZohoImportPage = () => {
  return (
    <main className="container space-y-8 py-8 md:py-16">
      <AdminPageHeader
        className="mx-auto w-full max-w-5xl"
        title="Zoho Inventory Import"
        description="Upload a supplier invoice to extract wine items and generate a Zoho-compatible CSV for bulk import."
      />
      <Card className="mx-auto w-full max-w-5xl">
        <CardContent>
          <div className="mt-6">
            <ZohoImportClient />
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default ZohoImportPage;
