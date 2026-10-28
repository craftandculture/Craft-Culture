/**
 * One CSV cell, quoted when it needs to be and never read as a formula
 *
 * Wine names, notes and addresses come from people, and a spreadsheet opens a
 * cell starting with =, +, -, @ (or a tab or carriage return) as a formula.
 * Text like that is prefixed with an apostrophe so it shows as typed. Numbers
 * pass through untouched, negative ones included.
 *
 * @example
 *   csvCell('=HYPERLINK("x")'); // `"'=HYPERLINK(""x"")"`
 *   csvCell(-12); // '-12'
 *
 * @param value - The cell's value
 * @param options - `alwaysQuote` to wrap every cell in quotes
 * @returns The cell as it goes into the file
 */
const csvCell = (
  value: string | number | null | undefined,
  options: { alwaysQuote?: boolean } = {},
) => {
  if (value === null || value === undefined)
    return options.alwaysQuote ? '""' : '';

  const raw = String(value);
  const text =
    typeof value === 'string' && /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;

  return options.alwaysQuote || /[",\n\r]/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
};

export default csvCell;
