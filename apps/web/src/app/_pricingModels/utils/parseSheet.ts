import * as XLSX from 'xlsx';

const parseSheet = (buffer: ArrayBuffer, sheetIndex: number) => {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[sheetIndex];

  if (!sheetName) {
    throw new Error(`Sheet at index ${sheetIndex} not found`);
  }

  const worksheet = workbook.Sheets[sheetName];

  return {
    worksheet,
    workbook,
    sheetName,
  };
};

export default parseSheet;
