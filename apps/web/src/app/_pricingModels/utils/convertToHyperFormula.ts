import ExcelJS from 'exceljs';
import { HyperFormula, Sheet } from 'hyperformula';

const convertToHyperFormula = async (
  buffer: ArrayBuffer,
  sheetName?: string,
) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheetsAsJavascriptArrays: Record<string, Sheet> = {};

  workbook.eachSheet((worksheet) => {
    const sheetData: unknown[][] = [];

    worksheet.eachRow((row) => {
      const rowData: unknown[] = [];

      row.eachCell({ includeEmpty: true }, (cell) => {
        const cellData = cell.formula ? `=${cell.formula}` : cell.value;
        rowData.push(cellData);
      });

      sheetData.push(rowData);
    });

    sheetsAsJavascriptArrays[worksheet.name] = sheetData as Sheet;
  });

  const hfInstance = HyperFormula.buildFromSheets(sheetsAsJavascriptArrays, {
    licenseKey: 'gpl-v3',
  });

  const targetSheetName = sheetName ?? Object.keys(sheetsAsJavascriptArrays)[0];

  if (!targetSheetName) {
    throw new Error('No sheet name provided');
  }

  const sheetId = hfInstance.getSheetId(targetSheetName);

  if (sheetId === undefined) {
    throw new Error(
      `Sheet "${targetSheetName}" not found in workbook. Available sheets: ${Object.keys(sheetsAsJavascriptArrays).join(', ')}`,
    );
  }

  const formulas = hfInstance.getSheetSerialized(sheetId);
  const values = hfInstance.getSheetValues(sheetId);

  const namedRanges = workbook.definedNames.model || [];

  return {
    sheetName: targetSheetName,
    formulas,
    values,
    namedExpressions: namedRanges.map((ne) => ({
      name: ne.name,
      ref: ne.ranges?.[0] ?? '',
    })),
  };
};

export default convertToHyperFormula;
