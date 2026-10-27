/**
 * Get the next path from URL query parameters with security validation
 *
 * Prevents open redirect attacks: the path is resolved against this site and
 * kept only when it stays on this site. Checking the string alone missed
 * `/\evil.com`, which browsers read as `//evil.com`.
 *
 * @returns The validated next path or null if invalid/missing
 */
const getNextPath = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const next = searchParams.get('next');

  if (!next || !next.startsWith('/') || next.includes('\\')) {
    return null;
  }

  try {
    const url = new URL(next, window.location.origin);

    if (url.origin !== window.location.origin) {
      return null;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
};

export default getNextPath;
