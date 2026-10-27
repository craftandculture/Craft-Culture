/**
 * C&C's own Vercel Blob store id, as it appears in every file URL the app has
 * written (`https://<store id>.public.blob.vercel-storage.com/...`). Kept here
 * so the check also works in the browser, where the token is not available.
 */
const CC_BLOB_STORE_ID = 'wejmklxaljhoatsp';

/** Store ids this deployment writes to: the known one, plus the one in its token */
const ownStoreIds = () => {
  const ids = new Set([CC_BLOB_STORE_ID]);

  try {
    // A read-write token is `vercel_blob_rw_<storeId>_<secret>`
    const fromToken = process.env.BLOB_READ_WRITE_TOKEN?.split('_')[3];
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    const fromEnv = process.env.BLOB_STORE_ID ?? process.env.NEXT_PUBLIC_BLOB_STORE_ID;

    for (const id of [fromToken, fromEnv]) {
      const clean = id?.trim().toLowerCase().replace(/^store_/, '');
      if (clean) ids.add(clean);
    }
  } catch {
    // No process.env in this runtime: the known store only
  }

  return ids;
};

/**
 * Whether a URL points at C&C's own Vercel Blob store
 *
 * SSRF and spoofing guard: user-supplied `blobUrl` values are persisted as a
 * document's `fileUrl` and later fetched server-side by the extraction jobs,
 * or shown to staff as "the uploaded file". Only C&C's own store is accepted,
 * public or private, so a caller cannot point the server at internal services
 * or cloud metadata endpoints (169.254.169.254), nor pass off a file hosted in
 * somebody else's Blob store.
 *
 * @example
 *   isVercelBlobUrl('https://wejmklxaljhoatsp.public.blob.vercel-storage.com/x.pdf'); // true
 *   isVercelBlobUrl('https://other.public.blob.vercel-storage.com/x.pdf'); // false
 *   isVercelBlobUrl('http://169.254.169.254/latest/meta-data/'); // false
 *
 * @param url - The URL to validate
 * @returns True only for an https URL in C&C's own Blob store
 */
const isVercelBlobUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;

    const match = /^([a-z0-9]+)\.(public|private)\.blob\.vercel-storage\.com$/.exec(
      parsed.hostname.toLowerCase(),
    );

    return !!match?.[1] && ownStoreIds().has(match[1]);
  } catch {
    return false;
  }
};

export default isVercelBlobUrl;
