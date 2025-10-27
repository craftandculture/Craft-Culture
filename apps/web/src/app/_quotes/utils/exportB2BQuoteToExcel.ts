import * as XLSX from 'xlsx';

import convertUsdToAed from '@/utils/convertUsdToAed';

import type { B2BCalculatorResult } from './calculateB2BQuote';
import type { B2BCalculatorLineItem } from '../components/B2BCalculator/B2BCalculator';

/**
 * Export B2B distributor calculator results to Excel file with line items
 *
 * @example
 *   exportB2BQuoteToExcel(
 *     calculatedQuote,
 *     'USD',
 *     lineItems,
 *     14,
 *     21,
 *     20,
 *     200,
 *     'percentage',
 *     15,
 *     {}
 *   );
 *
 * @param calculatedQuote - Calculator result with pricing breakdown
 * @param currency - Currency code (USD or AED)
 * @param lineItems - Optional array of line items from quote builder
 * @param leadTimeMin - Minimum lead time in days
 * @param leadTimeMax - Maximum lead time in days
 * @param importTaxPercent - Import tax percentage for per-product calculations
 * @param transferCostTotal - Total transfer cost to allocate across products
 * @param globalMarginType - Global margin type (percentage or fixed)
 * @param globalMarginValue - Global margin value
 * @param productMargins - Per-product margin overrides (index-based)
 */
const exportB2BQuoteToExcel = (
  calculatedQuote: B2BCalculatorResult,
  currency: string,
  lineItems?: B2BCalculatorLineItem[],
  leadTimeMin?: number,
  leadTimeMax?: number,
  importTaxPercent?: number,
  transferCostTotal?: number,
  globalMarginType?: 'percentage' | 'fixed',
  globalMarginValue?: number,
  productMargins?: Record<number, { type: 'percentage' | 'fixed'; value: number }>,
) => {
  // Convert USD to display currency if needed
  const convertValue = (usdValue: number) => {
    return currency === 'AED' ? convertUsdToAed(usdValue) : usdValue;
  };

  // Helper: Calculate customer price per case for a product
  const calculateCustomerPricePerCase = (
    item: B2BCalculatorLineItem,
    productIndex: number,
  ) => {
    if (
      !importTaxPercent ||
      !transferCostTotal ||
      !globalMarginType ||
      globalMarginValue === undefined
    ) {
      // Fallback: return In-Bond price if calculation params not provided
      return item.lineItemTotalUsd / item.quantity;
    }

    const totalQuantity = lineItems!.reduce((sum, i) => sum + i.quantity, 0);
    const inBondPerCase = item.lineItemTotalUsd / item.quantity;
    const importTaxPerCase = inBondPerCase * (importTaxPercent / 100);
    const transferCostPerCase = transferCostTotal / totalQuantity;
    const landedPrice = inBondPerCase + importTaxPerCase + transferCostPerCase;

    // Get margin config (override or global)
    const marginConfig = productMargins?.[productIndex] ?? {
      type: globalMarginType,
      value: globalMarginValue,
    };

    // Calculate price after margin
    const priceAfterMargin =
      marginConfig.type === 'percentage'
        ? landedPrice / (1 - marginConfig.value / 100)
        : landedPrice + marginConfig.value;

    const vat = priceAfterMargin * 0.05;
    return priceAfterMargin + vat;
  };

  // Helper: Calculate customer price per bottle
  const calculateCustomerPricePerBottle = (
    item: B2BCalculatorLineItem,
    productIndex: number,
  ) => {
    const pricePerCase = calculateCustomerPricePerCase(item, productIndex);
    return pricePerCase / item.unitCount;
  };

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();

  // Prepare data array
  const data: (string | number)[][] = [
    // Header
    ['B2B Distributor Quote Export', '', '', '', ''],
    [],
  ];

  // Add line items section if available
  if (lineItems && lineItems.length > 0) {
    data.push(
      ['LINE ITEMS', '', '', '', ''],
      [
        'Product',
        'Quantity',
        `In-Bond/Case (${currency})`,
        `Customer Price/Case (${currency})`,
        `Customer Price/Bottle (${currency})`,
      ],
    );

    lineItems.forEach((item, index) => {
      const inBondPerCase = item.lineItemTotalUsd / item.quantity;
      const customerPricePerCase = calculateCustomerPricePerCase(item, index);
      const customerPricePerBottle = calculateCustomerPricePerBottle(item, index);

      data.push([
        item.productName,
        `${item.quantity} cases`,
        Math.round(convertValue(inBondPerCase)),
        Math.round(convertValue(customerPricePerCase)),
        Math.round(convertValue(customerPricePerBottle) * 100) / 100, // Show cents for per-bottle
      ]);
    });

    data.push(
      [],
      [
        'Subtotal (In Bond UAE Price)',
        '',
        '',
        '',
        Math.round(convertValue(calculatedQuote.inBondPrice)),
      ],
      [],
    );
  }

  // Add B2B calculator breakdown
  data.push(
    ['B2B DISTRIBUTOR CALCULATIONS', '', '', '', ''],
    ['Component', 'Description', '', '', `Amount (${currency})`],
    [
      'In Bond UAE Price',
      lineItems ? 'Subtotal from line items above' : 'Base UAE in bond price',
      '',
      '',
      Math.round(convertValue(calculatedQuote.inBondPrice)),
    ],
    [
      'Import Duty',
      'Applied to in bond price',
      '',
      '',
      Math.round(convertValue(calculatedQuote.importTax)),
    ],
    [
      'Transfer Cost',
      'UAE In Bond -> Mainland delivery',
      '',
      '',
      Math.round(convertValue(calculatedQuote.transferCost)),
    ],
    [
      'Landed Price',
      'In Bond + Import Duty + Transfer',
      '',
      '',
      Math.round(convertValue(calculatedQuote.landedPrice)),
    ],
    [
      'Distributor Margin',
      'Your profit margin on landed price',
      '',
      '',
      Math.round(convertValue(calculatedQuote.distributorMargin)),
    ],
    [
      'VAT',
      '5% on price after margin',
      '',
      '',
      Math.round(convertValue(calculatedQuote.vat)),
    ],
    [],
    [
      'CUSTOMER PRICE',
      'Total price for end customer (incl. VAT)',
      '',
      '',
      Math.round(convertValue(calculatedQuote.customerQuotePrice)),
    ],
  );

  // Add lead time if provided
  if (leadTimeMin !== undefined && leadTimeMax !== undefined) {
    data.push(
      [],
      [
        'LEAD TIME',
        `${leadTimeMin}-${leadTimeMax} days via air freight`,
        '',
        '',
        '',
      ],
    );
  }

  // Create worksheet from data
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  ws['!cols'] = [
    { wch: 35 }, // Product/Component
    { wch: 15 }, // Quantity
    { wch: 20 }, // In-Bond Price
    { wch: 22 }, // Customer Price/Case
    { wch: 22 }, // Customer Price/Bottle or Amount
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
