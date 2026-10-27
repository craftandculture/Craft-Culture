import { eq, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import getCurrentUser from '@/app/_auth/data/getCurrentUser';
import resolveOrderParty from '@/app/_privateClientOrders/utils/resolveOrderParty';
import visibleDocumentTypes from '@/app/_privateClientOrders/utils/visibleDocumentTypes';
import isTeamMember from '@/app/_teamTasks/utils/isTeamMember';
import db from '@/database/client';
import {
  privateClientOrderDocuments,
  privateClientOrders,
  quotes,
} from '@/database/schema';
import { readStoredFile } from '@/lib/blob/privateFiles';
import { CC_PRIVATE_BLOB_STORE_ID } from '@/utils/isVercelBlobUrl';
import tryCatch from '@/utils/tryCatch';

type Viewer = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/**
 * Whether the viewer may open this file, decided by the record that holds it
 *
 * The file's address alone grants nothing: it must be on a record the viewer
 * can see. A file not yet on any record is one just uploaded, and only its
 * uploader may preview it, from the folder named after them.
 */
const mayOpen = async (viewer: Viewer, url: string, pathname: string) => {
  const isStaff = viewer.role === 'admin' && isTeamMember(viewer);

  const [quote] = await db
    .select({ userId: quotes.userId })
    .from(quotes)
    .where(or(eq(quotes.paymentProofUrl, url), eq(quotes.poAttachmentUrl, url)))
    .limit(1);

  if (quote) return isStaff || quote.userId === viewer.id;

  const [document] = await db
    .select({
      documentType: privateClientOrderDocuments.documentType,
      partnerId: privateClientOrders.partnerId,
      distributorId: privateClientOrders.distributorId,
    })
    .from(privateClientOrderDocuments)
    .innerJoin(
      privateClientOrders,
      eq(privateClientOrderDocuments.orderId, privateClientOrders.id),
    )
    .where(eq(privateClientOrderDocuments.fileUrl, url))
    .limit(1);

  if (document) {
    const { party } = await resolveOrderParty(viewer, document);
    return (
      !!party && visibleDocumentTypes(party).includes(document.documentType)
    );
  }

  // Uploaded but not yet attached: the uploader's own folder only
  return [`payment-proofs/${viewer.id}/`, `po-documents/${viewer.id}/`].some(
    (folder) => pathname.startsWith(folder),
  );
};

/**
 * Open a file from the private store, after checking who is asking
 *
 * Links to private files point here (see fileHref). The bytes are streamed from
 * the store server-side, so a browser never holds an address that works without
 * this check.
 */
export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) => {
  const { path } = await params;
  const pathname = path.map((part) => decodeURIComponent(part)).join('/');

  if (!pathname || pathname.includes('..')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [viewer] = await tryCatch(getCurrentUser());

  if (!viewer) {
    return NextResponse.json(
      { error: 'Please sign in to open this file' },
      { status: 401 },
    );
  }

  const url = `https://${CC_PRIVATE_BLOB_STORE_ID}.private.blob.vercel-storage.com/${path.join('/')}`;

  if (!(await mayOpen(viewer, url, pathname))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [file] = await tryCatch(readStoredFile(url));

  if (!file) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const name = (pathname.split('/').pop() ?? 'document')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .slice(0, 120);

  return new NextResponse(file.body, {
    headers: {
      'Content-Type': file.contentType,
      'Content-Disposition': `inline; filename="${name}"`,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
};
