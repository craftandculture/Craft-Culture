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
  commissionPerCase?: number;
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
 * @param commissionTotal - Optional total commission (B2C only)
 */
const exportQuoteToExcel = (
  lineItems: LineItemExport[],
  currency: string,
  totalPrice: number,
  commissionTotal?: number,
) => {
  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();

  // Prepare data for export
  const hasCommission = commissionTotal !== undefined && commissionTotal > 0;

  const headers = [
    'Reference',
    'Vintage',
    'Quantity',
    'Unit Size',
    'Units per Case',
    'Total Bottles',
    `Price per Case (${currency})`,
    `Price per Bottle (${currency})`,
    `Total Price (${currency})`,
  ];

  // Add commission column header if B2C
  if (hasCommission) {
    headers.push(`Commission per Case (${currency})`);
  }

  const data = [
    // Header row
    headers,
    // Data rows
    ...lineItems.map((item) => {
      const row = [
        item.reference,
        item.vintage,
        item.quantity,
        item.unitSize,
        item.unitsPerCase,
        item.totalBottles,
        Math.round(item.pricePerCase),
        Math.round(item.pricePerBottle),
        Math.round(item.totalPrice),
      ];

      // Add commission column if B2C
      if (hasCommission && item.commissionPerCase !== undefined) {
        row.push(Math.round(item.commissionPerCase));
      }

      return row;
    }),
    // Empty row
    [],
  ];

  // Add subtotal, commission, and total rows if B2C
  if (hasCommission) {
    const subtotal = totalPrice - commissionTotal;
    data.push(
      ['', '', '', '', '', '', '', '', 'Subtotal:', Math.round(subtotal), ''],
      [
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'Commission:',
        Math.round(commissionTotal),
        '',
      ],
      ['', '', '', '', '', '', '', '', 'Total:', Math.round(totalPrice), ''],
    );
  } else {
    // Just total row for B2B
    data.push(['', '', '', '', '', '', '', '', 'Total:', Math.round(totalPrice)]);
  }

  // Create worksheet from data
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  const columnWidths = [
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

  // Add commission column width if B2C
  if (hasCommission) {
    columnWidths.push({ wch: 25 }); // Commission per Case
  }

  ws['!cols'] = columnWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Quote');

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `quote_${timestamp}.xlsx`;

  // Download file
  XLSX.writeFile(wb, filename);
};

export default exportQuoteToExcel;
