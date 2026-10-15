/**
 * Return a URL only if it is safe to use as a link target.
 *
 * Accepts absolute https URLs and same-origin relative paths (starting with a
 * single `/`). Anything else, notably `javascript:`, `data:` and
 * protocol-relative `//host` URLs, returns undefined, so stored URLs can never
 * run script when passed to `href` or `window.open`.
 *
 * @example
 *   safeHref('https://abc.public.blob.vercel-storage.com/po.pdf'); // the URL
 *   safeHref('/platform/quotes'); // '/platform/quotes'
 *   safeHref('javascript:alert(1)'); // undefined
 *
 * @param url - The candidate URL, typically read from the database
 * @returns The URL if safe, otherwise undefined
 */
const safeHref = (url: string | null | undefined) => {
  if (!url) return undefined;
  const trimmed = url.trim();

  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) {
    return trimmed;
  }

  try {
    return new URL(trimmed).protocol === 'https:' ? trimmed : undefined;
  } catch {
    return undefined;
  }
};

export default safeHref;
