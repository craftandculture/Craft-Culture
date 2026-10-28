import { CC_PRIVATE_BLOB_STORE_ID } from './isVercelBlobUrl';

const PRIVATE_HOST = `${CC_PRIVATE_BLOB_STORE_ID}.private.blob.vercel-storage.com`;

/**
 * The link to open a stored file
 *
 * A file in the private store has no public address: it is opened through
 * /api/files, which checks the viewer may see it. Anything else (older files
 * still in the public store) is linked as it is.
 *
 * @example
 *   fileHref(
 *     'https://gasgxoqd6n5v8ara.private.blob.vercel-storage.com/a/b.pdf',
 *   );
 *   // '/api/files/a/b.pdf'
 *
 * @param url - The file URL stored on a record
 * @returns A link a browser can open
 */
const fileHref = <T extends string | null | undefined>(url: T): T => {
  if (!url) return url;

  try {
    const parsed = new URL(url);

    if (parsed.hostname.toLowerCase() !== PRIVATE_HOST) return url;

    return `/api/files${parsed.pathname}` as T;
  } catch {
    return url;
  }
};

export default fileHref;
