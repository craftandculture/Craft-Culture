import escapeHtml from './escapeHtml';

/**
 * Escape a plain-text quote field for HTML, keeping entities already written
 *
 * Quotes ported from the Python builder hold some values pre-escaped (e.g. a
 * price basis of "duty, VAT &amp; delivery paid"). Escaping those again would
 * show "&amp;" on the page, so an existing entity is left as it is while any
 * markup is neutralised.
 *
 * @example
 *   escapeQuoteText('Tignanello & Sassicaia <b>'); // 'Tignanello &amp; Sassicaia &lt;b&gt;'
 *   escapeQuoteText('VAT &amp; delivery'); // 'VAT &amp; delivery'
 *
 * @param value - The text to escape
 * @returns HTML-safe text
 */
const escapeQuoteText = (value: unknown) =>
  escapeHtml(value).replace(/&amp;(#\d{1,6}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31});/gi, '&$1;');

export default escapeQuoteText;
