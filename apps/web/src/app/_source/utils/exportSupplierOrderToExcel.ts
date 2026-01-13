import * as XLSX from 'xlsx';

interface SupplierOrderItem {
  productName: string | null;
  producer?: string | null;
  vintage: string | null;
  lwin7: string | null;
  lwin18: string | null;
  quantityBottles: number | null;
  quantityCases: number | null;
  caseConfig: string | number | null;
  costPerBottleUsd: number | null;
  costPerCaseUsd: number | null;
  lineTotalUsd: number | null;
}

interface SupplierOrderData {
  orderNumber: string;
  partnerName: string;
  customerPoNumber?: string | null;
  customerCompany?: string | null;
  createdAt?: Date | string | null;
  items: SupplierOrderItem[];
  totalAmountUsd: number | null;
}

/**
 * Export Supplier Order to Excel with LWIN codes
 *
 * Creates a workbook with columns:
 * - Product Name
 * - Vintage
 * - LWIN7
 * - LWIN18
 * - Qty (btl)
 * - Case Config
 * - Cases Required
 * - Cost/btl (USD)
 * - Case Price (USD)
 * - Total Cost (USD)
 *
 * @example
 *   exportSupplierOrderToExcel(orderData);
 */
const exportSupplierOrderToExcel = (order: SupplierOrderData) => {
  const wb = XLSX.utils.book_new();

  // Build header info
  const headerRows: (string | number | null)[][] = [
    ['SUPPLIER ORDER'],
    [`Order: ${order.orderNumber}`],
    [`Supplier: ${order.partnerName}`],
  ];

  if (order.customerPoNumber) {
    headerRows.push([`Customer PO: ${order.customerPoNumber}`]);
  }
  if (order.customerCompany) {
    headerRows.push([`Customer: ${order.customerCompany}`]);
  }
  if (order.createdAt) {
    headerRows.push([
      `Date: ${new Date(order.createdAt).toLocaleDateString()}`,
    ]);
  }
  headerRows.push([]);

  // Column headers
  headerRows.push([
    'Product Name',
    'Vintage',
    'LWIN7',
    'LWIN18',
    'Qty (btl)',
    'Case Config',
    'Cases Required',
    'Cost/btl (USD)',
    'Case Price (USD)',
    'Total Cost (USD)',
  ]);

  // Build data rows
  const dataRows: (string | number | null)[][] = [];

  order.items.forEach((item) => {
    dataRows.push([
      item.productName || '',
      item.vintage || '',
      item.lwin7 || '',
      item.lwin18 || '',
      item.quantityBottles || '',
      item.caseConfig || '',
      item.quantityCases || '',
      item.costPerBottleUsd !== null
        ? Math.round(item.costPerBottleUsd * 100) / 100
        : 'TBC',
      item.costPerCaseUsd !== null
        ? Math.round(item.costPerCaseUsd * 100) / 100
        : 'TBC',
      item.lineTotalUsd !== null
        ? Math.round(item.lineTotalUsd * 100) / 100
        : 'TBC',
    ]);
  });

  // Add totals row
  dataRows.push([]);
  dataRows.push([
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    'TOTAL',
    order.totalAmountUsd !== null
      ? Math.round(order.totalAmountUsd * 100) / 100
      : 'TBC',
  ]);

  // Combine header and data
  const allRows = [...headerRows, ...dataRows];

  const ws = XLSX.utils.aoa_to_sheet(allRows);

  // Set column widths
  ws['!cols'] = [
    { wch: 45 }, // Product Name
    { wch: 8 }, // Vintage
    { wch: 10 }, // LWIN7
    { wch: 20 }, // LWIN18
    { wch: 10 }, // Qty (btl)
    { wch: 12 }, // Case Config
    { wch: 14 }, // Cases Required
    { wch: 14 }, // Cost/btl (USD)
    { wch: 16 }, // Case Price (USD)
    { wch: 16 }, // Total Cost (USD)
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Order');

  // Generate filename
  const timestamp = new Date().toISOString().split('T')[0];
  const safeOrderNumber = order.orderNumber.replace(/[^a-zA-Z0-9-]/g, '_');
  const safePartnerName = order.partnerName
    .replace(/[^a-zA-Z0-9-]/g, '_')
    .slice(0, 20);
  const filename = `SupplierOrder_${safeOrderNumber}_${safePartnerName}_${timestamp}.xlsx`;

  return { workbook: wb, filename };
};

/**
 * Export Supplier Order to Excel buffer for email/upload
 *
 * @example
 *   const buffer = exportSupplierOrderToBuffer(orderData);
 */
export const exportSupplierOrderToBuffer = (order: SupplierOrderData) => {
  const { workbook, filename } = exportSupplierOrderToExcel(order);
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return { buffer, filename };
};

/**
 * Export Supplier Order to base64 string for API responses
 *
 * @example
 *   const { base64, filename } = exportSupplierOrderToBase64(orderData);
 */
export const exportSupplierOrderToBase64 = (order: SupplierOrderData) => {
  const { workbook, filename } = exportSupplierOrderToExcel(order);
  const base64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
  return { base64, filename };
};

export default exportSupplierOrderToExcel;
