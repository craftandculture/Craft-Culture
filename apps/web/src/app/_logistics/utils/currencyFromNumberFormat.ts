/**
 * Read the currency out of a spreadsheet cell's number format
 *
 * A workbook states its currency in the format applied to its money cells —
 * `[$£-809]#,##0.00` is a pound cell, and no reading of the text can be more
 * certain than that. It matters because Wilkinson's headings say only
 * "Price/Case" and "Total Price": nothing on the sheet's face is denominated,
 * so a GBP invoice was assumed to be dollars and £31,018.30 was booked as
 * $31,018.30 with nothing recording the swap.
 *
 * The leading `$` inside `[$…]` is Excel's marker for the block, not a dollar
 * sign, so it is stripped before symbols are looked for — reading it literally
 * would make every pound-formatted sheet in existence read as USD.
 *
 * @example
 *   currencyFromNumberFormat('[$£-809]#,##0.00'); // 'GBP'
 *   currencyFromNumberFormat('"$"#,##0.00'); // 'USD'
 *   currencyFromNumberFormat('#,##0.00'); // null — it says nothing
 *
 * @param format - The cell's number format string
 * @returns An ISO code, or null where the format is not denominated
 */
const currencyFromNumberFormat = (format: string | undefined | null) => {
  if (!format) return null;

  const marker = /\[\$([^\]]*)\]/g;
  const symbols: string[] = [];

  let match = marker.exec(format);

  while (match !== null) {
    // "[$£-809]" carries the symbol before the locale id
    symbols.push((match[1] ?? '').split('-')[0] ?? '');
    match = marker.exec(format);
  }

  // Whatever is left over: quoted literals like "£"#,##0.00, and bare symbols
  symbols.push(format.replace(marker, ' ').replace(/"/g, ' '));

  const text = symbols.join(' ');

  if (/£|\bGBP\b/i.test(text)) return 'GBP';
  if (/€|\bEUR\b/i.test(text)) return 'EUR';
  if (/\bCHF\b|\bFr\.?\b/i.test(text)) return 'CHF';
  if (/\bAED\b|د\.إ/i.test(text)) return 'AED';
  if (/¥|\bJPY\b/i.test(text)) return 'JPY';
  // Last, so a pound or euro symbol in the same format always wins
  if (/\$|\bUSD\b/i.test(text)) return 'USD';

  return null;
};

export default currencyFromNumberFormat;
