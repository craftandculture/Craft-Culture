import * as XLSX from 'xlsx';

interface PricingItem {
  lwin: string | null;
  productName: string;
  vintage: string | null;
  region: string | null;
  producer: string | null;
  bottleSize: string | null;
  caseConfig: number | null;
  inBondCaseUsd: number | null;
  inBondBottleUsd: number | null;
  inBondCaseAed: number | null;
  inBondBottleAed: number | null;
}

/**
 * Export B2B (In-Bond UAE) pricing data to Excel file
 *
 * @example
 *   exportB2BToExcel(items, 'Supplier Price List');
 *
 * @param items - Array of pricing items to export
 * @param sessionName - Name of the pricing session (used in filename)
 */
const exportB2BToExcel = (items: PricingItem[], sessionName: string) => {
  const wb = XLSX.utils.book_new();

  const headers = [
    'LWIN',
    'Product Name',
    'Vintage',
    'Region',
    'Producer',
    'Bottle Size',
    'Case Config',
    'In-Bond/Case (USD)',
    'In-Bond/Bottle (USD)',
    'In-Bond/Case (AED)',
    'In-Bond/Bottle (AED)',
  ];

  const data = [
    headers,
    ...items.map((item) => [
      item.lwin ?? '',
      item.productName,
      item.vintage ?? '',
      item.region ?? '',
      item.producer ?? '',
      item.bottleSize ?? '',
      item.caseConfig ?? '',
      item.inBondCaseUsd !== null ? Math.round(item.inBondCaseUsd * 100) / 100 : '',
      item.inBondBottleUsd !== null ? Math.round(item.inBondBottleUsd * 100) / 100 : '',
      item.inBondCaseAed !== null ? Math.round(item.inBondCaseAed) : '',
      item.inBondBottleAed !== null ? Math.round(item.inBondBottleAed) : '',
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  ws['!cols'] = [
    { wch: 15 }, // LWIN
    { wch: 40 }, // Product Name
    { wch: 10 }, // Vintage
    { wch: 20 }, // Region
    { wch: 25 }, // Producer
    { wch: 12 }, // Bottle Size
    { wch: 12 }, // Case Config
    { wch: 18 }, // In-Bond/Case USD
    { wch: 18 }, // In-Bond/Bottle USD
    { wch: 18 }, // In-Bond/Case AED
    { wch: 18 }, // In-Bond/Bottle AED
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'B2B Prices');

  // Generate filename
  const timestamp = new Date().toISOString().split('T')[0];
  const safeName = sessionName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  const filename = `B2B_${safeName}_${timestamp}.xlsx`;

  XLSX.writeFile(wb, filename);
};

export default exportB2BToExcel;
