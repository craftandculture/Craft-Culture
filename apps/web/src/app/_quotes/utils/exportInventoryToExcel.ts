import * as XLSX from 'xlsx';

interface InventoryItemExport {
  reference: string;
  producer: string;
  vintage: string;
  region: string;
  lwin18: string;
  unitSize: string;
  unitsPerCase: number;
  pricePerCase: number;
  pricePerBottle: number;
  availableQuantity: number;
}

/**
 * Export inventory data to Excel file
 *
 * @example
 *   exportInventoryToExcel(inventoryItems, 'USD');
 *
 * @param inventoryItems - Array of inventory items to export
 * @param currency - Currency code (USD or AED)
 */
const exportInventoryToExcel = (
  inventoryItems: InventoryItemExport[],
  currency: string,
) => {
  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();

  // Prepare data for export
  const data = [
    // Header row
    [
      'Reference',
      'Producer',
      'Vintage',
      'Region',
      'LWIN18',
      'Unit Size',
      'Units per Case',
      `Price per Case (${currency})`,
      `Price per Bottle (${currency})`,
      'Available Quantity',
    ],
    // Data rows
    ...inventoryItems.map((item) => [
      item.reference,
      item.producer,
      item.vintage,
      item.region,
      item.lwin18,
      item.unitSize,
      item.unitsPerCase,
      Math.round(item.pricePerCase),
      Math.round(item.pricePerBottle),
      item.availableQuantity,
    ]),
  ];

  // Create worksheet from data
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  ws['!cols'] = [
    { wch: 50 }, // Reference
    { wch: 30 }, // Producer
    { wch: 10 }, // Vintage
    { wch: 20 }, // Region
    { wch: 20 }, // LWIN18
    { wch: 12 }, // Unit Size
    { wch: 15 }, // Units per Case
    { wch: 20 }, // Price per Case
    { wch: 20 }, // Price per Bottle
    { wch: 18 }, // Available Quantity
  ];

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Inventory');

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `inventory_list_${timestamp}.xlsx`;

  // Download file
  XLSX.writeFile(wb, filename);
};

export default exportInventoryToExcel;
