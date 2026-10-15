import isVercelBlobUrl from '@/utils/isVercelBlobUrl';

/** The Hillebrand API host, from the same setting the integration uses */
const hillebrandApiHost = () => {
  try {
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    return new URL(process.env.HILLEBRAND_API_URL ?? 'https://api.hillebrandgori.com').hostname;
  } catch {
    return null;
  }
};

/** Domains Hillebrand serves document downloads from */
const HILLEBRAND_DOMAINS = ['hillebrandgori.com', 'hillebrand.com'];

/**
 * Whether the server may fetch a logistics document's stored file URL
 *
 * SSRF guard. A document's `fileUrl` is either a Vercel Blob upload or, for
 * documents synced by the Hillebrand integration, Hillebrand's own
 * `downloadUrl`. Anything else (an internal address, a cloud metadata
 * endpoint, an arbitrary host) is refused before it is fetched.
 *
 * @example
 *   isFetchableLogisticsFileUrl('https://abc.public.blob.vercel-storage.com/x.pdf'); // true
 *   isFetchableLogisticsFileUrl('http://169.254.169.254/latest/meta-data/'); // false
 *
 * @param url - The stored file URL
 * @returns True for Vercel Blob or an https Hillebrand URL
 */
const isFetchableLogisticsFileUrl = (url: string) => {
  if (isVercelBlobUrl(url)) return true;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;

    const host = parsed.hostname.toLowerCase();
    if (host === hillebrandApiHost()) return true;

    return HILLEBRAND_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
};

export default isFetchableLogisticsFileUrl;
