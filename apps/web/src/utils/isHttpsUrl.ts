/**
 * Whether a string is an absolute https URL.
 *
 * `z.string().url()` accepts any scheme, including `javascript:` and `data:`,
 * so a stored "URL" can execute script when rendered as a link or opened with
 * `window.open`. Use this as a schema refinement for links that may point at
 * external sites (payment links, logos).
 *
 * @example
 *   isHttpsUrl('https://pay.example.com/abc'); // true
 *   isHttpsUrl('javascript:alert(1)'); // false
 *
 * @param url - The URL to validate
 * @returns True only for a parseable https URL
 */
const isHttpsUrl = (url: string) => {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
};

export default isHttpsUrl;
