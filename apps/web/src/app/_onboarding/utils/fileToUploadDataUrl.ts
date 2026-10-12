/**
 * Read a chosen file as a data URL, shrinking photos on the way
 *
 * Phone cameras produce 4–8MB images, which are slow over mobile data and
 * close to the 10MB upload limit. Photos are redrawn at most 2000px on the long
 * side as JPEG — still sharp enough to read an ID — and PDFs pass through.
 *
 * @param file - The file the person chose or photographed
 * @returns A data URL ready to upload, and the name to send with it
 */
const fileToUploadDataUrl = async (file: File) => {
  const readAsDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Could not read that file'));
      reader.readAsDataURL(blob);
    });

  /*
    Uploads travel as base64 in one request, which Vercel caps at 4.5MB. A
    photo is shrunk below, but a PDF cannot be, so a large one is refused here
    with a message the person can act on.
  */
  if (file.type === 'application/pdf' && file.size > 3 * 1024 * 1024) {
    throw new Error('That PDF is over 3MB. Please upload a photo of your ID, or a smaller PDF.');
  }

  if (!file.type.startsWith('image/') || file.type === 'image/gif') {
    return { dataUrl: await readAsDataUrl(file), filename: file.name };
  }

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return { dataUrl: await readAsDataUrl(file), filename: file.name };

  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.85),
  );

  return {
    dataUrl: await readAsDataUrl(blob ?? file),
    filename: `${file.name.replace(/\.[^.]+$/, '') || 'id'}.jpg`,
  };
};

export default fileToUploadDataUrl;
