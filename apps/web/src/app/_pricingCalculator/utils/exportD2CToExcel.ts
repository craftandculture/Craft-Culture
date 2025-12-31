import * as XLSX from 'xlsx';

interface PricingItem {
  lwin: string | null;
  productName: string;
  vintage: string | null;
  region: string | null;
  producer: string | null;
  bottleSize: string | null;
  caseConfig: number | null;
  deliveredCaseUsd: number | null;
  deliveredBottleUsd: number | null;
  deliveredCaseAed: number | null;
  deliveredBottleAed: number | null;
}

/**
 * Export D2C (Delivered) pricing data to Excel file
 *
 * @example
 *   exportD2CToExcel(items, 'Supplier Price List');
 *
 * @param items - Array of pricing items to export
 * @param sessionName - Name of the pricing session (used in filename)
 */
const exportD2CToExcel = (items: PricingItem[], sessionName: string) => {
  const wb = XLSX.utils.book_new();

  const headers = [
    'LWIN',
    'Product Name',
    'Vintage',
    'Region',
    'Producer',
    'Bottle Size',
    'Case Config',
    'Delivered/Case (USD)',
    'Delivered/Bottle (USD)',
    'Delivered/Case (AED)',
    'Delivered/Bottle (AED)',
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
      item.deliveredCaseUsd !== null ? Math.round(item.deliveredCaseUsd * 100) / 100 : '',
      item.deliveredBottleUsd !== null ? Math.round(item.deliveredBottleUsd * 100) / 100 : '',
      item.deliveredCaseAed !== null ? Math.round(item.deliveredCaseAed) : '',
      item.deliveredBottleAed !== null ? Math.round(item.deliveredBottleAed) : '',
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
    { wch: 20 }, // Delivered/Case USD
    { wch: 20 }, // Delivered/Bottle USD
    { wch: 20 }, // Delivered/Case AED
    { wch: 20 }, // Delivered/Bottle AED
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'D2C Prices');

  // Generate filename
  const timestamp = new Date().toISOString().split('T')[0];
  const safeName = sessionName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  const filename = `D2C_${safeName}_${timestamp}.xlsx`;

  XLSX.writeFile(wb, filename);
};

export default exportD2CToExcel;
