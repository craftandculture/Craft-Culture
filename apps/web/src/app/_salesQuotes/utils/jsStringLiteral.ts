/**
 * A value as a JavaScript string literal safe to place inside a `<script>`
 *
 * `JSON.stringify` handles quotes and backslashes; `<` is escaped so the value
 * cannot close the script element, and the line separators JSON allows but
 * older JS parsers reject are escaped too.
 *
 * @example
 *   jsStringLiteral("O'Brien </script>"); // "\"O'Brien \\u003c/script>\""
 *
 * @param value - The text to embed
 * @returns A quoted JS string literal
 */
const jsStringLiteral = (value: unknown) =>
  JSON.stringify(String(value ?? ''))
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

export default jsStringLiteral;
