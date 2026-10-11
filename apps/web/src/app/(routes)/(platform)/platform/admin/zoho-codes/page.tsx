import ZohoCodesClient from '@/app/_zohoCodes/components/ZohoCodesClient';

/**
 * Zoho code cleanup
 *
 * Matches every Zoho item to its Stock Explorer code: dashes added to compact
 * SKUs, duplicates and non-LWIN codes made inactive, each batch undoable.
 */
const ZohoCodesPage = () => (
  <main className="container py-6">
    <ZohoCodesClient />
  </main>
);

export default ZohoCodesPage;
