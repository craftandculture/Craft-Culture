import { TRPCError } from '@trpc/server';

/**
 * Read a file the browser sent, either inline or already uploaded to Blob
 *
 * Inline files travel as base64 inside the request body, which Vercel caps at
 * 4.5MB — so anything over about 3.3MB was refused before our code ran, and
 * the page showed "Request Entity Too Large… is not valid JSON". Larger files
 * go to Blob straight from the browser and arrive here as a URL instead.
 *
 * Only Vercel Blob URLs are fetched, so the server cannot be pointed at an
 * arbitrary address.
 *
 * @param input - Either `file` (base64 or data URL) or `blobUrl`
 * @returns The file's bytes
 */
const readUploadedFile = async (input: { file?: string | null; blobUrl?: string | null }) => {
  if (input.blobUrl) {
    const url = new URL(input.blobUrl);

    if (url.protocol !== 'https:' || !url.hostname.endsWith('.blob.vercel-storage.com')) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unrecognised file location' });
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Could not read the uploaded file' });
    }

    return Buffer.from(await response.arrayBuffer());
  }

  const base64Data = input.file?.includes(',') ? input.file.split(',')[1] : input.file;

  if (!base64Data) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid file format' });
  }

  return Buffer.from(base64Data, 'base64');
};

export default readUploadedFile;
