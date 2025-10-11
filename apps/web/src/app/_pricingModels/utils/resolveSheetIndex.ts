import * as XLSX from 'xlsx';

const resolveSheetIndex = (
  workbook: XLSX.WorkBook,
  sheetName?: string,
): number => {
  if (!sheetName) {
    return 0;
  }

  const sheetIndex = workbook.SheetNames.indexOf(sheetName);

  if (sheetIndex === -1) {
    throw new Error(
      `Sheet "${sheetName}" not found. Available sheets: ${workbook.SheetNames.join(', ')}`,
    );
  }

  return sheetIndex;
};

export default resolveSheetIndex;
