import { HyperFormula, RawCellContent, Sheets } from 'hyperformula';

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
  availableQuantity: number | null;
  product: {
    id: string;
    lwin18: string;
    name: string;
    region: string | null;
    producer: string | null;
    year: number | null;
  };
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

/**
 * Calculate In-Bond UAE prices for multiple product offers using pricing model
 *
 * @param offers - Product offers to calculate prices for
 * @param cellMappings - Cell mappings from pricing model
 * @param formulaData - Formula data from pricing model sheet
 * @param customerType - Customer type (b2b or b2c)
 * @param exchangeRateMap - Map of currency to USD exchange rates
 * @returns Map of offer ID to In-Bond USD price
 */
const calculateInBondPrices = (
  offers: ProductOffer[],
  cellMappings: CellMappingSchema,
  formulaData: Record<string, unknown>,
  customerType: 'b2b' | 'b2c' | 'private_clients',
  exchangeRateMap: Map<string, number>,
): Map<string, number> => {
  const result = new Map<string, number>();

  if (offers.length === 0) {
    return result;
  }

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
    const sheet = sheetName || defaultSheetName;

    const colIndex = col
      ?.split('')
      .reduce((acc, char) => acc * 26 + char.charCodeAt(0) - 65, 0);

    if (colIndex === undefined) return null;

    const rowIndex = parseInt(row ?? '0') - 1;

    if (rowIndex === undefined) return null;

    const sheetId = hf.getSheetId(sheet ?? '');

    if (sheetId === undefined) {
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
    const sheet = sheetName || defaultSheetName;

    const colIndex = startCol
      ?.split('')
      .reduce((acc, char) => acc * 26 + char.charCodeAt(0) - 65, 0);

    if (colIndex === undefined) return null;

    const startRowIndex = parseInt(startRow ?? '0') - 1;

    if (startRowIndex === undefined) return null;

    const sheetId = hf.getSheetId(sheet ?? '');

    if (sheetId === undefined) {
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

  // Process offers in batches (max 10 at a time due to spreadsheet row limits)
  const batchSize = 10;

  for (let batchStart = 0; batchStart < offers.length; batchStart += batchSize) {
    const batch = offers.slice(batchStart, batchStart + batchSize);

    // Clear previous batch data by setting empty values
    for (let i = 0; i < batchSize; i++) {
      setColumnValue(cellMappings.name, i, '');
      setColumnValue(cellMappings.quantity, i, 0);
      setColumnValue(cellMappings.price, i, 0);
    }

    // Set offer data in the sheet (quantity = 1 to get per-case price)
    for (let i = 0; i < batch.length; i++) {
      const offer = batch[i];
      if (!offer) continue;

      const exchangeRate = exchangeRateMap.get(offer.currency) ?? 1;

      setColumnValue(cellMappings.name, i, offer.product.name);
      setColumnValue(cellMappings.lwin18, i, offer.product.lwin18);
      setColumnValue(cellMappings.region, i, offer.product.region);
      setColumnValue(cellMappings.producer, i, offer.product.producer);
      setColumnValue(cellMappings.vintage, i, offer.product.year);
      setColumnValue(cellMappings.quantity, i, 1); // 1 case for per-case price
      setColumnValue(cellMappings.unitCount, i, offer.unitCount);
      setColumnValue(cellMappings.unitSize, i, offer.unitSize);
      setColumnValue(cellMappings.source, i, offer.source);
      setColumnValue(cellMappings.price, i, offer.price);
      setColumnValue(cellMappings.currency, i, offer.currency);
      setColumnValue(cellMappings.exchangeRateUsd, i, exchangeRate);
    }

    // Read calculated prices for this batch
    for (let i = 0; i < batch.length; i++) {
      const offer = batch[i];
      if (!offer) continue;

      const priceUsd = getColumnValue(cellMappings.priceUsd, i);
      const inBondPriceUsd = typeof priceUsd === 'number' ? priceUsd : 0;

      result.set(offer.id, inBondPriceUsd);
    }
  }

  return result;
};

export default calculateInBondPrices;
