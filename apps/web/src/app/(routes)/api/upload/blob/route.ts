import { type HandleUploadBody, handleUpload } from '@vercel/blob';
import { NextResponse } from 'next/server';

import getCurrentUser from '@/app/_auth/data/getCurrentUser';

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
      onBeforeGenerateToken: async () => {
        const user = await getCurrentUser();
        if (!user) {
          throw new Error('Unauthorized');
        }

        return {
          allowedContentTypes: [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
          ],
          maximumSizeInBytes: 10 * 1024 * 1024, // 10MB
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
