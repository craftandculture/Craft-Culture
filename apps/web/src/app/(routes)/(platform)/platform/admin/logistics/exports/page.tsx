import ExportJobsClient from '@/app/_logistics/components/exports/ExportJobsClient';

/**
 * Export jobs
 *
 * Every job leaving the UAE, numbered EXP-CNC/YY/NNNN, with the movement bond
 * on bonded transfers. Run by the logistics team.
 */
const ExportJobsPage = () => (
  <main className="container py-6">
    <ExportJobsClient />
  </main>
);

export default ExportJobsPage;
