/**
 * Escape a value for safe interpolation into the quote template.
 *
 * @example
 *   escapeHtml('Château "A" & B'); // 'Château &quot;A&quot; &amp; B'
 *
 * @param value - The value to escape; null and undefined become an empty string
 * @returns The HTML-escaped string
 */
const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

export default escapeHtml;
