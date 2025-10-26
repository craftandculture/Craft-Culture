import { HyperFormula, RawCellContent, Sheets } from 'hyperformula';

import logger from '@/utils/logger';

import type { CellMappingSchema } from '../schemas/cellMappingSchema';

interface ProductOffer {
  id: string;
  productId: string;
  externalId: string;
  source: string;
  price: number;
  currency: string;
  unitCount: number;
  unitSize: string;
  availableQuantity: number;
  product: {
    id: string;
    lwin18: string;
    name: string;
    region: string | null;
    producer: string | null;
    year: number | null;
  };
}

interface LineItemInput {
  offerId: string;
  quantity: number;
}

interface QuoteLineItem {
  productId: string;
  lineItemTotalUsd: number;
  commissionUsd: number;
  basePriceUsd: number;
}

interface QuoteData {
  lineItems: QuoteLineItem[];
  totalUsd: number;
  totalCommissionUsd: number;
  subtotalBeforeCommissionUsd: number;
}

interface StoredSheetData {
  sheetName: string;
  formulas: RawCellContent[][];
  values: unknown[][];
}

interface StoredFormulaData {
  sheets: StoredSheetData[];
  namedExpressions: Array<{ name: string; ref: string }>;
}

/** Calculates quote data from a pricing model using HyperFormula */
export function calculateQuote(
  lineItemsInput: LineItemInput[],
  offers: ProductOffer[],
  cellMappings: CellMappingSchema,
  formulaData: Record<string, unknown>,
  customerType: 'b2b' | 'b2c',
  exchangeRateMap: Map<string, number>,
): QuoteData {
  // Convert stored formula data to HyperFormula format
  const storedData = formulaData as unknown as StoredFormulaData;
  const sheets: Sheets = {};

  // Build sheets object from all stored sheets
  for (const sheet of storedData.sheets) {
    sheets[sheet.sheetName] = sheet.formulas;
  }

  // Initialize HyperFormula with the sheet data
  const hf = HyperFormula.buildFromSheets(sheets, {
    licenseKey: 'gpl-v3',
  });

  // Use the first sheet as default if no sheet name is specified in cell references
  const defaultSheetName = storedData.sheets[0]?.sheetName || '';

  // Helper function to parse cell reference and return address components
  const parseCellRef = (cellRef: string | undefined) => {
    if (!cellRef) return null;

    const match = cellRef.match(/(?:'([^']+)'!)?([A-Z]+)(\d+)$/);
    if (!match) return null;

    const [, sheetName, col, row] = match;
    // Use the specified sheet name, or default to first sheet if not specified
    const sheet = sheetName || defaultSheetName;

    const colIndex = col
      ?.split('')
      .reduce((acc, char) => acc * 26 + char.charCodeAt(0) - 65, 0);

    if (colIndex === undefined) return null;

    const rowIndex = parseInt(row ?? '0') - 1;

    if (rowIndex === undefined) return null;

    const sheetId = hf.getSheetId(sheet ?? '');

    if (sheetId === undefined) {
      logger.error(
        `Sheet "${sheet}" not found. Available sheets: ${Object.keys(sheets).join(', ')}`,
      );
      return null;
    }

    return { sheet: sheetId, col: colIndex, row: rowIndex };
  };

  // Helper function to parse column range and return starting address
  const parseColumnRange = (rangeRef: string | undefined) => {
    if (!rangeRef) return null;

    const match = rangeRef.match(/(?:'([^']+)'!)?([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    if (!match) return null;

    const [, sheetName, startCol, startRow] = match;
    // Use the specified sheet name, or default to first sheet if not specified
    const sheet = sheetName || defaultSheetName;

    const colIndex = startCol
      ?.split('')
      .reduce((acc, char) => acc * 26 + char.charCodeAt(0) - 65, 0);

    if (colIndex === undefined) return null;

    const startRowIndex = parseInt(startRow ?? '0') - 1;

    if (startRowIndex === undefined) return null;

    const sheetId = hf.getSheetId(sheet ?? '');

    if (sheetId === undefined) {
      logger.error(
        `Sheet "${sheet}" not found. Available sheets: ${Object.keys(sheets).join(', ')}`,
      );
      return null;
    }

    return { sheet: sheetId, col: colIndex, startRow: startRowIndex };
  };

  // Helper function to set a cell value
  const setCellValue = (cellRef: string | undefined, value: unknown) => {
    const address = parseCellRef(cellRef);
    if (!address) return;
    hf.setCellContents(address, [[value as RawCellContent]]);
  };

  // Helper function to set values in a column
  const setColumnValue = (
    rangeRef: string | undefined,
    rowOffset: number,
    value: unknown,
  ) => {
    const range = parseColumnRange(rangeRef);
    if (!range) return;
    hf.setCellContents(
      { sheet: range.sheet, col: range.col, row: range.startRow + rowOffset },
      [[value as RawCellContent]],
    );
  };

  // Helper function to get cell value
  const getCellValue = (cellRef: string | undefined): unknown => {
    const address = parseCellRef(cellRef);
    if (!address) return undefined;
    return hf.getCellValue(address);
  };

  // Helper function to get value from column at specific row
  const getColumnValue = (
    rangeRef: string | undefined,
    rowOffset: number,
  ): unknown => {
    const range = parseColumnRange(rangeRef);
    if (!range) return undefined;
    return hf.getCellValue({
      sheet: range.sheet,
      col: range.col,
      row: range.startRow + rowOffset,
    });
  };

  // Set customer type
  setCellValue(cellMappings.customerType, customerType);

  // Map each offer to the corresponding row in the sheet
  for (let i = 0; i < lineItemsInput.length; i++) {
    const lineItem = lineItemsInput[i];

    if (!lineItem) continue;

    const offer = offers.find((o) => o.id === lineItem.offerId);

    if (!offer) continue;

    // Get exchange rate from pre-fetched map
    const exchangeRate = exchangeRateMap.get(offer.currency) ?? 1;

    // Set all the offer data in the sheet
    setColumnValue(cellMappings.name, i, offer.product.name);
    setColumnValue(cellMappings.lwin18, i, offer.product.lwin18);
    setColumnValue(cellMappings.region, i, offer.product.region);
    setColumnValue(cellMappings.producer, i, offer.product.producer);
    setColumnValue(cellMappings.vintage, i, offer.product.year);
    setColumnValue(cellMappings.quantity, i, lineItem.quantity);
    setColumnValue(cellMappings.unitCount, i, offer.unitCount);
    setColumnValue(cellMappings.unitSize, i, offer.unitSize);
    setColumnValue(cellMappings.source, i, offer.source);
    setColumnValue(cellMappings.price, i, offer.price);
    setColumnValue(cellMappings.currency, i, offer.currency);
    setColumnValue(cellMappings.exchangeRateUsd, i, exchangeRate);
  }

  // Get final total
  const finalPriceUsd = getCellValue(cellMappings.finalPriceUsd);
  const totalUsd = typeof finalPriceUsd === 'number' ? finalPriceUsd : 0;

  // Build line items result
  const quoteLineItems: QuoteLineItem[] = lineItemsInput.map((lineItem, i) => {
    const offer = offers.find((o) => o.id === lineItem.offerId);

    if (!offer) {
      return {
        productId: '',
        lineItemTotalUsd: 0,
        commissionUsd: 0,
        basePriceUsd: 0,
      };
    }

    const priceUsd = getColumnValue(cellMappings.priceUsd, i);
    // priceUsd from the sheet already includes quantity calculation
    const lineItemTotalUsd = typeof priceUsd === 'number' ? priceUsd : 0;

    // Get base price from spreadsheet (Column M - already mapped)
    const basePriceValue = getColumnValue(cellMappings.basePriceUsd, i);
    const basePriceUsd = typeof basePriceValue === 'number' ? basePriceValue : 0;

    // Calculate commission: 5% of base price per case × quantity
    const commissionPerCase = basePriceUsd * 0.05;
    const commissionUsd =
      customerType === 'b2c' ? commissionPerCase * lineItem.quantity : 0;

    return {
      productId: offer.productId,
      lineItemTotalUsd,
      commissionUsd,
      basePriceUsd,
    };
  });

  // Calculate total commission and subtotal
  const totalCommissionUsd = quoteLineItems.reduce(
    (sum, item) => sum + item.commissionUsd,
    0,
  );

  const subtotalBeforeCommissionUsd = totalUsd - totalCommissionUsd;

  return {
    lineItems: quoteLineItems,
    totalUsd,
    totalCommissionUsd,
    subtotalBeforeCommissionUsd,
  };
}
