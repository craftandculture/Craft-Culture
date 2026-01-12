/**
 * Get the next path from URL query parameters with security validation
 *
 * Prevents open redirect attacks by ensuring the path is:
 * - A relative path starting with /
 * - Not a protocol-relative URL (//)
 * - Does not contain protocol schemes
 *
 * @returns The validated next path or null if invalid/missing
 */
const getNextPath = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const next = searchParams.get('next');

  if (!next) {
    return null;
  }

  // Must start with a single forward slash (relative path)
  if (!next.startsWith('/')) {
    return null;
  }

  // Prevent protocol-relative URLs (//evil.com)
  if (next.startsWith('//')) {
    return null;
  }

  // Prevent any protocol schemes (javascript:, data:, etc.)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(next)) {
    return null;
  }

  // Prevent encoded protocol schemes
  const decoded = decodeURIComponent(next);
  if (decoded.startsWith('//') || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(decoded)) {
    return null;
  }

  return next;
};

export default getNextPath;
