/**
 * Read a file into a base64 string with no data: prefix
 *
 * Documents are sent to the server as base64 in a tRPC call rather than as a
 * multipart upload, which keeps the extraction endpoint an ordinary procedure
 * and leaves nothing on disk afterwards.
 *
 * @param file - The file the user selected
 * @returns The file's bytes, base64-encoded
 */
const fileToBase64 = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Chunked rather than spread into one call — a multi-megabyte PDF blows the
  // argument limit of String.fromCharCode in one go.
  const CHUNK = 0x8000;
  let binary = '';

  for (let index = 0; index < bytes.length; index += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(index, index + CHUNK));
  }

  return window.btoa(binary);
};

export default fileToBase64;
