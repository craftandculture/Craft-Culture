import type { ZohoItem } from '../schemas/zohoItemSchema';

/**
 * Format case configuration for display
 *
 * @example
 *   formatCaseConfig(6, 750); // returns '6x75cl'
 *   formatCaseConfig(12, 750); // returns '12x75cl'
 */
const formatCaseConfig = (caseConfig: number, bottleSizeMl: number): string => {
  // Convert ml to cl for display
  const bottleSizeCl = Math.round(bottleSizeMl / 10);
  return `${caseConfig}x${bottleSizeCl}cl`;
};

/**
 * Format a single item as a Zoho CSV row
 */
const formatZohoRow = (item: ZohoItem, supplierName: string): string[] => {
  const caseConfigDisplay = formatCaseConfig(item.caseConfig, item.bottleSize);

  // Build item name: Wine name + vintage + case config
  const itemName = item.vintage
    ? `${item.lwinDisplayName || item.productName} ${item.vintage}`
    : item.lwinDisplayName || item.productName;

  return [
    itemName, // Item Name
    item.sku, // SKU
    caseConfigDisplay, // Sales Description
    '2.00', // Selling Price (AED placeholder)
    'FALSE', // Is Returnable Item
    '', // Brand
    '', // Manufacturer
    item.hsCode, // UPC (used for HS Code)
    '', // EAN
    item.country || '', // ISBN (used for Country of Origin)
    '', // Part Number
    'Goods', // Product Type (must be capitalized)
    'Sales', // Sales Account
    'Case', // Unit
    caseConfigDisplay, // Purchase Description
    '1.00', // Purchase Price (AED placeholder)
    'Inventory', // Item Type
    'Cost of Goods Sold', // Purchase Account
    'Inventory', // Inventory Account
    'fifo', // Inventory Valuation Method (must be lowercase!)
    '', // Reorder Level
    supplierName, // Preferred Vendor
    String(item.quantity), // Opening Stock
    String(item.quantity), // Opening Stock Value (1 AED per case)
    'true', // Sellable (lowercase)
    'true', // Purchasable (lowercase)
    'true', // Track Inventory (lowercase)
    'Zero Rate', // Tax Name
  ];
};

/**
 * Escape a CSV field value
 */
const escapeCsvField = (value: string): string => {
  // If value contains comma, newline, or quote, wrap in quotes and escape quotes
  if (value.includes(',') || value.includes('\n') || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return `"${value}"`;
};

/**
 * Generate Zoho-compatible CSV content from items
 *
 * @param items - Array of Zoho items to export
 * @param supplierName - Supplier/vendor name for Preferred Vendor field
 * @returns CSV content as string
 */
const formatZohoCsv = (items: ZohoItem[], supplierName: string): string => {
  const headers = [
    'Item Name',
    'SKU',
    'Sales Description',
    'Selling Price',
    'Is Returnable Item',
    'Brand',
    'Manufacturer',
    'UPC',
    'EAN',
    'ISBN',
    'Part Number',
    'Product Type',
    'Sales Account',
    'Unit',
    'Purchase Description',
    'Purchase Price',
    'Item Type',
    'Purchase Account',
    'Inventory Account',
    'Inventory Valuation Method',
    'Reorder Level',
    'Preferred Vendor',
    'Opening Stock',
    'Opening Stock Value',
    'Sellable',
    'Purchasable',
    'Track Inventory',
    'Tax Name',
  ];

  const rows = items.map((item) => formatZohoRow(item, supplierName));

  // Format as CSV
  const headerLine = headers.map(escapeCsvField).join(',');
  const dataLines = rows.map((row) => row.map(escapeCsvField).join(',')).join('\n');

  return `${headerLine}\n${dataLines}\n`;
};

export default formatZohoCsv;
