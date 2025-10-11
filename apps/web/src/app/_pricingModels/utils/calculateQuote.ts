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
}

interface QuoteData {
  lineItems: QuoteLineItem[];
  totalUsd: number;
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
      console.error(
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
      console.error(
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

  console.log('═══════════════════════════════════════════════════════');
  console.log('calculateQuote - STARTING CALCULATION');
  console.log('═══════════════════════════════════════════════════════');

  console.log('\n📥 INPUT DATA:');
  console.log('  Line Items:', lineItemsInput);
  console.log('  Offers Count:', offers.length);
  console.log('  Customer Type:', customerType);
  console.log('  Default Sheet Name:', defaultSheetName);
  console.log('  All Sheet Names:', Object.keys(sheets));

  // Log a sample of the sheet structure from Example Pricing Model sheet
  console.log('\n📊 SHEET STRUCTURE SAMPLE (Example Pricing Model, row 7):');
  const exampleSheet = storedData.sheets.find(
    (s) => s.sheetName === 'Example Pricing Model',
  );
  if (exampleSheet) {
    console.log(`  Sheet: "${exampleSheet.sheetName}"`);
    console.log(`  Total rows: ${exampleSheet.formulas.length}`);
    // Show rows 6, 7, 8 to see if there's a pattern
    for (
      let rowIdx = 5;
      rowIdx <= 7 && rowIdx < exampleSheet.formulas.length;
      rowIdx++
    ) {
      console.log(`  Row ${rowIdx + 1} columns L-Q (indices 11-16):`);
      for (let col = 11; col <= 16; col++) {
        const colLetter = String.fromCharCode(65 + col);
        const cellValue = exampleSheet.formulas[rowIdx]?.[col];
        console.log(
          `    ${colLetter}${rowIdx + 1}: ${JSON.stringify(cellValue)}`,
        );
      }
    }
  }

  console.log('\n📋 CELL MAPPINGS:');
  console.log(JSON.stringify(cellMappings, null, 2));

  // Log what columns each mapping corresponds to
  console.log('\n🔤 COLUMN LETTERS:');
  for (const [key, value] of Object.entries(cellMappings)) {
    if (typeof value === 'string') {
      const match = value.match(
        /(?:'([^']+)'!)?([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/,
      );
      if (match) {
        const [, , startCol, , , endCol, ,] = match;
        console.log(
          `  ${key}: Column ${startCol}${endCol ? `-${endCol}` : ''} (${value})`,
        );
      }
    }
  }

  console.log('\n🔧 SETTING CUSTOMER TYPE:', customerType);
  setCellValue(cellMappings.customerType, customerType);
  const customerTypeCheck = getCellValue(cellMappings.customerType);
  console.log('  ✓ Customer type cell value after set:', customerTypeCheck);

  console.log('\n🍷 PROCESSING OFFERS:');
  for (let i = 0; i < lineItemsInput.length; i++) {
    const lineItem = lineItemsInput[i];

    if (!lineItem) continue;

    const offer = offers.find((o) => o.id === lineItem.offerId);
    if (offer) {
      console.log(`\n  [Offer ${i}]`);
      console.log('    Product:', offer.product.name);
      console.log('    Price:', offer.price, offer.currency);
      console.log('    Quantity:', lineItem.quantity);
      console.log('    Unit Count:', offer.unitCount);
      console.log('    Unit Size:', offer.unitSize);
    }
  }

  // Map each offer to the corresponding row in the sheet
  for (let i = 0; i < lineItemsInput.length; i++) {
    const lineItem = lineItemsInput[i];

    if (!lineItem) continue;

    const offer = offers.find((o) => o.id === lineItem.offerId);

    if (!offer) continue;

    console.log(`\n  ⚙️ [Row ${i}] Processing...`);

    // Get exchange rate from pre-fetched map
    const exchangeRate = exchangeRateMap.get(offer.currency) ?? 1;
    console.log(
      `    💱 Exchange Rate (${offer.currency} -> USD):`,
      exchangeRate,
    );

    // Set all the offer data in the sheet
    console.log('    📝 Setting cell values...');
    setColumnValue(cellMappings.name, i, offer.product.name);
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

    console.log('    🔍 Reading back values:');
    console.log('      Name:', getColumnValue(cellMappings.name, i));
    console.log(
      '      Price (original):',
      getColumnValue(cellMappings.price, i),
    );
    console.log('      Currency:', getColumnValue(cellMappings.currency, i));
    console.log(
      '      Exchange Rate:',
      getColumnValue(cellMappings.exchangeRateUsd, i),
    );
    console.log('      Quantity:', getColumnValue(cellMappings.quantity, i));

    const priceUsdValue = getColumnValue(cellMappings.priceUsd, i);
    console.log('      💰 Price USD (calculated by sheet):', priceUsdValue);

    // Check what formula is in the priceUsd cell
    const priceUsdRange = parseColumnRange(cellMappings.priceUsd);
    if (priceUsdRange) {
      const cellAddress = {
        sheet: priceUsdRange.sheet,
        col: priceUsdRange.col,
        row: priceUsdRange.startRow + i,
      };
      const cellFormula = hf.getCellFormula(cellAddress);
      console.log(
        `      📐 Formula in priceUsd cell Q${priceUsdRange.startRow + i + 1}:`,
        cellFormula || '(no formula)',
      );

      // Check what's in the cells that the formula references (columns L through P)
      console.log('      🔍 Checking related cells:');
      for (let col = 11; col <= 16; col++) {
        // L=11, M=12, N=13, O=14, P=15, Q=16
        const colLetter = String.fromCharCode(65 + col);
        const value = hf.getCellValue({
          sheet: priceUsdRange.sheet,
          col,
          row: priceUsdRange.startRow + i,
        });
        const formula = hf.getCellFormula({
          sheet: priceUsdRange.sheet,
          col,
          row: priceUsdRange.startRow + i,
        });
        console.log(
          `        ${colLetter}${priceUsdRange.startRow + i + 1}: ${value} ${formula ? `(=${formula})` : ''}`,
        );
      }
    }

    if (priceUsdValue === null || priceUsdValue === undefined) {
      console.log(
        '      ⚠️  WARNING: priceUsd is null/undefined - formula might be missing or incorrect',
      );
    }
  }

  console.log('\n💵 GETTING FINAL TOTAL:');
  console.log('  Cell Reference:', cellMappings.finalPriceUsd);

  const finalPriceUsd = getCellValue(cellMappings.finalPriceUsd);
  console.log('  Raw Value:', finalPriceUsd);
  console.log('  Value Type:', typeof finalPriceUsd);

  // Check what formula is in the finalPriceUsd cell
  const finalPriceAddress = parseCellRef(cellMappings.finalPriceUsd);
  if (finalPriceAddress) {
    const finalFormula = hf.getCellFormula(finalPriceAddress);
    console.log(
      '  📐 Formula in finalPriceUsd cell:',
      finalFormula || '(no formula)',
    );
  }

  const totalUsd = typeof finalPriceUsd === 'number' ? finalPriceUsd : 0;
  console.log('  ✓ Final Total USD:', totalUsd);

  if (totalUsd === 0) {
    console.log(
      '  ⚠️  WARNING: Final total is 0 - check if cell B4 has the correct formula',
    );
  }

  console.log('\n📦 BUILDING LINE ITEMS RESULT:');
  const quoteLineItems: QuoteLineItem[] = lineItemsInput.map((lineItem, i) => {
    const offer = offers.find((o) => o.id === lineItem.offerId);

    if (!offer) {
      console.log(`  ❌ [Line Item ${i}] Offer not found`);
      return {
        productId: '',
        lineItemTotalUsd: 0,
      };
    }

    const priceUsd = getColumnValue(cellMappings.priceUsd, i);
    // priceUsd from the sheet already includes quantity calculation
    const lineItemTotalUsd = typeof priceUsd === 'number' ? priceUsd : 0;

    console.log(`  ✓ [Line Item ${i}]`);
    console.log(`    Product ID: ${offer.productId}`);
    console.log(`    Price USD (from sheet): ${priceUsd}`);
    console.log(`    Quantity: ${lineItem.quantity}`);
    console.log(`    Line Item Total: ${lineItemTotalUsd}`);

    return {
      productId: offer.productId,
      lineItemTotalUsd,
    };
  });

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('✅ CALCULATION COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log('FINAL RESULT:');
  console.log('  Total USD:', totalUsd);
  console.log('  Line Items Count:', quoteLineItems.length);
  console.log('  Line Items:', JSON.stringify(quoteLineItems, null, 2));
  console.log('═══════════════════════════════════════════════════════\n');

  return {
    lineItems: quoteLineItems,
    totalUsd,
  };
}
