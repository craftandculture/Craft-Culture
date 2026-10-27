import { type HandleUploadBody, handleUpload } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

import getCurrentUser from '@/app/_auth/data/getCurrentUser';
import isTeamMember from '@/app/_teamTasks/utils/isTeamMember';

/**
 * Where staff uploads may land. Every caller today is a staff screen: Team
 * Tasks files, logistics group invoices and documents, export documents. A
 * bare file name (no folder) is still accepted for the shipment document
 * upload, which does not prefix its path yet.
 */
const TEAM_TASK_PATH = /^team-tasks\/[0-9a-f-]{36}\/[^/]+$/i;
const LOGISTICS_PATH = /^logistics\/[\w-]+\/[\w-]+\/[^/]+$/;
const BARE_FILE_NAME = /^[^/]+$/;

const isAllowedPathname = (pathname: string) =>
  !pathname.split('/').some((segment) => segment === '.' || segment === '..') &&
  !pathname.includes('\\') &&
  (TEAM_TASK_PATH.test(pathname) ||
    LOGISTICS_PATH.test(pathname) ||
    BARE_FILE_NAME.test(pathname));

/**
 * Vercel Blob client upload handler
 *
 * Generates upload tokens for client-side file uploads to Vercel Blob.
 * Bypasses the serverless function body size limit (4.5MB) by uploading
 * directly from the browser to Blob storage.
 */
export const POST = async (request: Request) => {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const user = await getCurrentUser();
        if (!user) {
          throw new Error('Unauthorized');
        }

        // Only C&C staff screens upload through here. Partners, members and
        // signups awaiting approval have no feature that uses it, so they
        // must not be able to write to Blob storage.
        if (user.approvalStatus !== 'approved' || !isTeamMember(user)) {
          throw new Error('Forbidden');
        }

        if (!isAllowedPathname(pathname)) {
          throw new Error('Upload location not allowed');
        }

        return {
          allowedContentTypes: [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            // Suppliers send the workbook of an invoice alongside its PDF.
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'text/csv',
            // Team Tasks: quotes, letters and decks attached to a job
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain',
          ],
          maximumSizeInBytes: 10 * 1024 * 1024, // 10MB
          /*
            The client uploads under the file's own name, so without this the
            second upload of a given filename fails outright — "This blob
            already exists". Two shipments that arrived on the same truck could
            not both carry IMG_1234.jpg, and the operator was told nothing
            except that Blob refused it.

            A suffix rather than allowOverwrite: the same filename from two
            shipments is two different photographs, and overwriting would leave
            the first shipment's document row pointing at the second one's
            image.
          */
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: user.id }),
        };
      },
      onUploadCompleted: async () => {
        // No-op — DB record is created separately via tRPC
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 400 },
    );
  }
};
