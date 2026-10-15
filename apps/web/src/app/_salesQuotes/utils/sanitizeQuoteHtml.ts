import escapeQuoteText from './escapeQuoteText';

/** `style` values a formatted quote field may keep: a single colour */
const SAFE_STYLE = /^color:\s*(?:var\(--[a-z0-9-]+\)|#[0-9a-f]{3,8})$/i;

/**
 * Render a formatted quote field (lead note, payment terms, extra terms)
 *
 * These fields carry light markup by design: the Python configs and the
 * default copy use `<b>`, `<strong style="color:var(--teal2)">`, `<em>`,
 * `<br>` and entities such as `&mdash;`. Everything is escaped first, then
 * only those tags (with at most a colour style) are restored, so the normal
 * copy renders exactly as before while any other markup shows as text.
 * Line breaks typed into the builder become `<br>`.
 *
 * @example
 *   sanitizeQuoteHtml('<b>Payment terms:</b> 30 days'); // unchanged
 *   sanitizeQuoteHtml('<img src=x onerror=alert(1)>'); // '&lt;img ...&gt;'
 *
 * @param value - The stored field
 * @returns HTML with only the allowed formatting
 */
const sanitizeQuoteHtml = (value: unknown) =>
  escapeQuoteText(value)
    .replace(
      /&lt;(b|strong|em|i)(?:\s+style=&quot;([^&]*(?:&(?!quot;)[^&]*)*)&quot;)?&gt;/gi,
      (match, tag: string, style?: string) => {
        if (style === undefined) return `<${tag}>`;
        const decoded = style.replace(/&#x27;/g, "'");
        return SAFE_STYLE.test(decoded.trim()) ? `<${tag} style="${decoded.trim()}">` : match;
      },
    )
    .replace(/&lt;\/(b|strong|em|i)&gt;/gi, '</$1>')
    .replace(/&lt;br\s*\/?&gt;/gi, '<br>')
    .replace(/\r?\n/g, '<br>');

export default sanitizeQuoteHtml;
