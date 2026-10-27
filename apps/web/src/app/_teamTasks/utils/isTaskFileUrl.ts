import isVercelBlobUrl from '@/utils/isVercelBlobUrl';

/**
 * Whether a Blob URL is a file uploaded for this job
 *
 * Job files are uploaded under `team-tasks/<taskId>/`. Checking the folder
 * stops a job from recording (and later deleting) a file that belongs to
 * something else in the same Blob store, such as a shipment document.
 *
 * @example
 *   isTaskFileUrl(
 *     'https://x.public.blob.vercel-storage.com/team-tasks/<id>/Quote-a1b2.pdf',
 *     '<id>',
 *   ); // true
 *
 * @param url - The stored or submitted file URL
 * @param taskId - The job the file should belong to
 * @returns True only for a Blob URL inside that job's folder
 */
const isTaskFileUrl = (url: string, taskId: string) => {
  if (!isVercelBlobUrl(url)) return false;
  try {
    return new URL(url).pathname.startsWith(`/team-tasks/${taskId}/`);
  } catch {
    return false;
  }
};

export default isTaskFileUrl;
