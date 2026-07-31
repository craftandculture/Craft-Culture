/**
 * Whether a URL points at Vercel Blob public storage.
 *
 * SSRF guard: user-supplied `blobUrl` values are persisted as a document's
 * `fileUrl` and later fetched server-side by the extraction jobs. Constraining
 * them to Vercel Blob's host prevents an authenticated caller from pointing the
 * server at internal services (e.g. the NUC) or cloud metadata endpoints
 * (169.254.169.254). All legitimate uploads go through `@vercel/blob`, whose
 * URLs are `https://<store>.public.blob.vercel-storage.com/...`.
 *
 * @example
 *   isVercelBlobUrl('https://abc.public.blob.vercel-storage.com/x.pdf'); // true
 *   isVercelBlobUrl('http://169.254.169.254/latest/meta-data/'); // false
 *
 * @param url - The URL to validate
 * @returns True only for an https Vercel Blob public-storage URL
 */
const isVercelBlobUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname.endsWith('.public.blob.vercel-storage.com')
    );
  } catch {
    return false;
  }
};

export default isVercelBlobUrl;
