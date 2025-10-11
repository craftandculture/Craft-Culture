import ExcelJS from 'exceljs';
import { HyperFormula, RawCellContent, Sheet } from 'hyperformula';

interface SheetData {
  sheetName: string;
  formulas: RawCellContent[][];
  values: unknown[][];
}

const convertToHyperFormula = async (buffer: ArrayBuffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheetsAsJavascriptArrays: Record<string, Sheet> = {};

  workbook.eachSheet((worksheet) => {
    const sheetData: unknown[][] = [];

    // Use worksheet.eachRow with includeEmpty to preserve row numbers
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      const rowData: unknown[] = [];

      // Get the maximum column number to ensure we include all columns
      const maxCol = worksheet.columnCount || 100;

      for (let col = 1; col <= maxCol; col++) {
        const cell = row.getCell(col);
        const cellData = cell.formula ? `=${cell.formula}` : cell.value;
        rowData.push(cellData);
      }

      sheetData.push(rowData);
    });

    sheetsAsJavascriptArrays[worksheet.name] = sheetData as Sheet;
  });

  const hfInstance = HyperFormula.buildFromSheets(sheetsAsJavascriptArrays, {
    licenseKey: 'gpl-v3',
  });

  const namedRanges = workbook.definedNames.model || [];

  // Serialize all sheets
  const sheets: SheetData[] = [];
  for (const sheetName of Object.keys(sheetsAsJavascriptArrays)) {
    const sheetId = hfInstance.getSheetId(sheetName);
    if (sheetId === undefined) continue;

    const formulas = hfInstance.getSheetSerialized(sheetId);
    const values = hfInstance.getSheetValues(sheetId);

    sheets.push({
      sheetName,
      formulas,
      values,
    });
  }

  return {
    sheets,
    namedExpressions: namedRanges.map((ne) => ({
      name: ne.name,
      ref: ne.ranges?.[0] ?? '',
    })),
  };
};

export default convertToHyperFormula;
