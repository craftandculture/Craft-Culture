import ExportJobClient from '@/app/_logistics/components/exports/ExportJobClient';

/** One export job: stage, details, invoice, bond and documents */
const ExportJobPage = async ({ params }: { params: Promise<{ shipmentId: string }> }) => {
  const { shipmentId } = await params;

  return (
    <main className="container py-6">
      <ExportJobClient shipmentId={shipmentId} />
    </main>
  );
};

export default ExportJobPage;
