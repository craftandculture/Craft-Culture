/**
 * Stop a CSV cell being read as a formula when opened in a spreadsheet
 *
 * Excel, Sheets and Numbers evaluate a cell that starts with `=`, `+`, `-` or
 * `@` (and tab or carriage return), so a wine or supplier name such as
 * `=HYPERLINK(...)` would run on whoever opens the export. Such text is
 * prefixed with a `'`, which spreadsheets treat as "this is text". Plain
 * numbers, including negatives like `-12.50`, are left alone so they still
 * import as numbers.
 *
 * @example
 *   neutraliseCsvFormula('=1+1'); // "'=1+1"
 *   neutraliseCsvFormula('-12.50'); // '-12.50'
 *
 * @param value - The cell text
 * @returns The text, prefixed if it would otherwise be a formula
 */
const neutraliseCsvFormula = (value: string) => {
  if (!/^[=+\-@\t\r]/.test(value)) return value;
  if (/^[+-]?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i.test(value.trim())) return value;
  return `'${value}`;
};

export default neutraliseCsvFormula;
