import { TRPCError } from '@trpc/server';

import { readStoredFileBuffer } from '@/lib/blob/privateFiles';
import isVercelBlobUrl from '@/utils/isVercelBlobUrl';

/**
 * Read a file the browser sent, either inline or already uploaded to Blob
 *
 * Inline files travel as base64 inside the request body, which Vercel caps at
 * 4.5MB — so anything over about 3.3MB was refused before our code ran, and
 * the page showed "Request Entity Too Large… is not valid JSON". Larger files
 * go to Blob straight from the browser and arrive here as a URL instead.
 *
 * Only URLs in C&C's own Blob store are fetched, so the server cannot be
 * pointed at an arbitrary address or another party's store.
 *
 * @param input - Either `file` (base64 or data URL) or `blobUrl`
 * @returns The file's bytes
 */
const readUploadedFile = async (input: { file?: string | null; blobUrl?: string | null }) => {
  if (input.blobUrl) {
    if (!isVercelBlobUrl(input.blobUrl)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unrecognised file location' });
    }

    const buffer = await readStoredFileBuffer(input.blobUrl);

    if (!buffer) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Could not read the uploaded file' });
    }

    return buffer;
  }

  const base64Data = input.file?.includes(',') ? input.file.split(',')[1] : input.file;

  if (!base64Data) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid file format' });
  }

  return Buffer.from(base64Data, 'base64');
};

export default readUploadedFile;
