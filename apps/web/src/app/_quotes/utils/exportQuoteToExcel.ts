import * as XLSX from 'xlsx';

interface LineItemExport {
  reference: string;
  vintage: string;
  quantity: number;
  unitSize: string;
  unitsPerCase: number;
  totalBottles: number;
  pricePerCase: number;
  pricePerBottle: number;
  totalPrice: number;
}

/**
 * Export quote data to Excel file
 *
 * @example
 *   exportQuoteToExcel(lineItems, 'USD', 123.45);
 *
 * @param lineItems - Array of line items to export
 * @param currency - Currency code (USD or AED)
 * @param totalPrice - Total quote price
 */
const exportQuoteToExcel = (
  lineItems: LineItemExport[],
  currency: string,
  totalPrice: number,
) => {
  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();

  // Prepare data for export
  const data = [
    // Header row
    [
      'Reference',
      'Vintage',
      'Quantity',
      'Unit Size',
      'Units per Case',
      'Total Bottles',
      `Price per Case (${currency})`,
      `Price per Bottle (${currency})`,
      `Total Price (${currency})`,
    ],
    // Data rows
    ...lineItems.map((item) => [
      item.reference,
      item.vintage,
      item.quantity,
      item.unitSize,
      item.unitsPerCase,
      item.totalBottles,
      item.pricePerCase,
      item.pricePerBottle,
      item.totalPrice,
    ]),
    // Empty row
    [],
    // Total row
    ['', '', '', '', '', '', '', 'Total:', totalPrice],
  ];

  // Create worksheet from data
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  ws['!cols'] = [
    { wch: 40 }, // Reference
    { wch: 10 }, // Vintage
    { wch: 10 }, // Quantity
    { wch: 12 }, // Unit Size
    { wch: 15 }, // Units per Case
    { wch: 15 }, // Total Bottles
    { wch: 20 }, // Price per Case
    { wch: 20 }, // Price per Bottle
    { wch: 20 }, // Total Price
  ];

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Quote');

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `quote_${timestamp}.xlsx`;

  // Download file
  XLSX.writeFile(wb, filename);
};

export default exportQuoteToExcel;
