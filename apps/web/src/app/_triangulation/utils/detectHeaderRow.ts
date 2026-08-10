/**
 * Guess which row of a sheet holds the column headers
 *
 * Monthly exports from Zoho and from City Drinks both tend to open with a
 * title and a filter line, so row 0 is usually not the header. The best
 * candidate is the earliest row that has several non-empty text cells and is
 * followed by a row of comparable width.
 *
 * @param matrix - The raw cell matrix from `parseWorkbook`
 * @returns The zero-based index of the most likely header row
 */
const detectHeaderRow = (matrix: unknown[][]) => {
  const limit = Math.min(matrix.length, 25);
  let bestIndex = 0;
  let bestScore = -1;

  for (let index = 0; index < limit; index += 1) {
    const row = matrix[index] ?? [];
    const textCells = row.filter(
      (cell) => typeof cell === 'string' && cell.trim().length > 0,
    ).length;

    if (textCells < 2) {
      continue;
    }

    const nextRow = matrix[index + 1] ?? [];
    const nextFilled = nextRow.filter(
      (cell) => cell !== null && cell !== undefined && String(cell).trim() !== '',
    ).length;

    // Prefer a wide text row that actually has data underneath it, and break
    // ties towards the top of the sheet.
    const score = textCells * 2 + Math.min(nextFilled, textCells) - index * 0.5;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  return bestIndex;
};

export default detectHeaderRow;
