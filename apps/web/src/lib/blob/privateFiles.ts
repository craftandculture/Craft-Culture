import { del, get, put } from '@vercel/blob';

import { CC_PRIVATE_BLOB_STORE_ID } from '@/utils/isVercelBlobUrl';

/** The private store's read-write token, set when the store was connected */
const privateToken = () => {
  const token = process.env.BLOB_PRIVATE_READ_WRITE_TOKEN;

  if (!token) {
    throw new Error('Private file storage is not configured');
  }

  return token;
};

/**
 * Whether a stored file URL is in C&C's private store
 *
 * @param url - A file URL as stored on a record
 * @returns True for a file that can only be read through /api/files
 */
export const isPrivateFileUrl = (url: string | null | undefined) => {
  if (!url) return false;

  try {
    return (
      new URL(url).hostname.toLowerCase() ===
      `${CC_PRIVATE_BLOB_STORE_ID}.private.blob.vercel-storage.com`
    );
  } catch {
    return false;
  }
};

/**
 * Store a file in the private store
 *
 * A random suffix is added so a file's address cannot be guessed from its name,
 * though the store refuses anyone without the token regardless.
 *
 * @example
 *   const { url } = await putPrivateFile(
 *     'payment-proofs/u1/proof.pdf',
 *     buffer,
 *     'application/pdf',
 *   );
 *
 * @param pathname - Where in the store, e.g. `private-orders/<id>/...`
 * @param body - The file's bytes
 * @param contentType - Its checked MIME type
 * @returns The stored file's URL, to be saved on the record
 */
export const putPrivateFile = async (
  pathname: string,
  body: Buffer | ArrayBuffer | Blob,
  contentType: string,
) => {
  const blob = await put(pathname, body, {
    access: 'private',
    contentType,
    addRandomSuffix: true,
    token: privateToken(),
  });

  return { url: blob.url, pathname: blob.pathname };
};

/**
 * Read a stored file, private or public, server-side
 *
 * @param url - The file URL stored on a record
 * @returns The response body and its content type, or null when missing
 */
export const readStoredFile = async (url: string) => {
  if (isPrivateFileUrl(url)) {
    const result = await get(url, { access: 'private', token: privateToken() });

    if (!result || result.statusCode !== 200) return null;

    return {
      body: result.stream,
      contentType: result.blob.contentType ?? 'application/octet-stream',
    };
  }

  const response = await fetch(url);

  if (!response.ok || !response.body) return null;

  return {
    body: response.body,
    contentType:
      response.headers.get('content-type') ?? 'application/octet-stream',
  };
};

/**
 * Read a stored file into memory, for extraction or attaching elsewhere
 *
 * @param url - The file URL stored on a record
 * @returns The file's bytes, or null when missing
 */
export const readStoredFileBuffer = async (url: string) => {
  const file = await readStoredFile(url);

  if (!file) return null;

  return Buffer.from(await new Response(file.body).arrayBuffer());
};

/**
 * Delete a stored file from whichever store holds it
 *
 * @param url - The file URL stored on a record
 */
export const deleteStoredFile = async (url: string) => {
  await del(url, isPrivateFileUrl(url) ? { token: privateToken() } : undefined);
};
