import * as XLSX from 'xlsx';

import type { B2BCalculatorResult } from './calculateB2BQuote';

/**
 * Export B2B distributor calculator results to Excel file
 *
 * @example
 *   exportB2BQuoteToExcel(calculatedQuote, 'USD');
 *
 * @param calculatedQuote - Calculator result with pricing breakdown
 * @param currency - Currency code (USD or AED)
 */
const exportB2BQuoteToExcel = (
  calculatedQuote: B2BCalculatorResult,
  currency: string,
) => {
  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();

  // Prepare breakdown data
  const data = [
    // Header
    ['B2B Distributor Pricing Calculator', '', ''],
    [],
    // Breakdown rows
    ['Component', 'Description', `Amount (${currency})`],
    [
      'In bond price',
      'Base UAE in bond price',
      Math.round(calculatedQuote.inBondPrice),
    ],
    [
      'Import tax',
      '20% of in bond price',
      Math.round(calculatedQuote.importTax),
    ],
    [
      'Distributor margin',
      '15% of in bond price',
      Math.round(calculatedQuote.distributorMargin),
    ],
    ['Transfer cost', 'Logistics transfer', Math.round(calculatedQuote.transferCost)],
    [],
    [
      'Customer quote price',
      'Total price for end customer',
      Math.round(calculatedQuote.customerQuotePrice),
    ],
  ];

  // Create worksheet from data
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  ws['!cols'] = [
    { wch: 25 }, // Component
    { wch: 30 }, // Description
    { wch: 20 }, // Amount
  ];

  // Bold the header and total rows (via styling - note: basic XLSX doesn't support full styling)
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'B2B Calculator');

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `b2b_calculator_${timestamp}.xlsx`;

  // Download file
  XLSX.writeFile(wb, filename);
};

export default exportB2BQuoteToExcel;
