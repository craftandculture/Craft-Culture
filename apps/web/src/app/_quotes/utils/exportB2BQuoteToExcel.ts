import * as XLSX from 'xlsx';

import convertUsdToAed from '@/utils/convertUsdToAed';

import type { B2BCalculatorResult } from './calculateB2BQuote';
import type { B2BCalculatorLineItem } from '../components/B2BCalculator/B2BCalculator';

/**
 * Export B2B distributor calculator results to Excel file with line items
 *
 * @example
 *   exportB2BQuoteToExcel(calculatedQuote, 'USD', lineItems);
 *
 * @param calculatedQuote - Calculator result with pricing breakdown
 * @param currency - Currency code (USD or AED)
 * @param lineItems - Optional array of line items from quote builder
 */
const exportB2BQuoteToExcel = (
  calculatedQuote: B2BCalculatorResult,
  currency: string,
  lineItems?: B2BCalculatorLineItem[],
) => {
  // Convert USD to display currency if needed
  const convertValue = (usdValue: number) => {
    return currency === 'AED' ? convertUsdToAed(usdValue) : usdValue;
  };
  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();

  // Prepare data array
  const data: (string | number)[][] = [
    // Header
    ['B2B Distributor Quote Export', '', '', ''],
    [],
  ];

  // Add line items section if available
  if (lineItems && lineItems.length > 0) {
    data.push(
      ['LINE ITEMS', '', '', ''],
      ['Product', 'Quantity', 'Base Price', `Total (${currency})`],
    );

    lineItems.forEach((item) => {
      data.push([
        item.productName,
        item.quantity,
        Math.round(convertValue(item.basePriceUsd)),
        Math.round(convertValue(item.lineItemTotalUsd)),
      ]);
    });

    data.push(
      [],
      [
        'Subtotal (In Bond UAE Price)',
        '',
        '',
        Math.round(convertValue(calculatedQuote.inBondPrice)),
      ],
      [],
    );
  }

  // Add B2B calculator breakdown
  data.push(
    ['B2B DISTRIBUTOR CALCULATIONS', '', '', ''],
    ['Component', 'Description', '', `Amount (${currency})`],
    [
      'In Bond UAE Price',
      lineItems ? 'Subtotal from line items above' : 'Base UAE in bond price',
      '',
      Math.round(convertValue(calculatedQuote.inBondPrice)),
    ],
    [
      'Import Duty',
      'Applied to in bond price',
      '',
      Math.round(convertValue(calculatedQuote.importTax)),
    ],
    [
      'Transfer Cost',
      'UAE In Bond -> Mainland delivery',
      '',
      Math.round(convertValue(calculatedQuote.transferCost)),
    ],
    [
      'Landed Price',
      'In Bond + Import Duty + Transfer',
      '',
      Math.round(convertValue(calculatedQuote.landedPrice)),
    ],
    [
      'Distributor Margin',
      'Your profit margin on landed price',
      '',
      Math.round(convertValue(calculatedQuote.distributorMargin)),
    ],
    [
      'VAT',
      '5% on price after margin',
      '',
      Math.round(convertValue(calculatedQuote.vat)),
    ],
    [],
    [
      'CUSTOMER PRICE',
      'Total price for end customer (incl. VAT)',
      '',
      Math.round(convertValue(calculatedQuote.customerQuotePrice)),
    ],
  );

  // Create worksheet from data
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  ws['!cols'] = [
    { wch: 30 }, // Product/Component
    { wch: 20 }, // Quantity/Description
    { wch: 15 }, // Base Price
    { wch: 20 }, // Total/Amount
  ];

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'B2B Quote');

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `b2b_calculator_${timestamp}.xlsx`;

  // Download file
  XLSX.writeFile(wb, filename);
};

export default exportB2BQuoteToExcel;
