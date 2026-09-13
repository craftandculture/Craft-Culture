import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import {
  STOCK_OWNER_PARTNER_TYPES,
} from '@/app/_auth/constants/accessProfiles';
import getCurrentUser from '@/app/_auth/data/getCurrentUser';
import resolvePartnerForUser from '@/app/_partners/data/resolvePartnerForUser';
import db from '@/database/client';
import { partnerIdentityDocuments } from '@/database/schema';
import isVercelBlobUrl from '@/utils/isVercelBlobUrl';
import tryCatch from '@/utils/tryCatch';

/**
 * Serve an identity document to someone entitled to see it
 *
 * Vercel Blob has no private tier, so the stored URL is a permanent
 * unauthenticated link to a government ID. It is never given to a browser.
 * This route checks who is asking, fetches the blob server-side and streams
 * the bytes back, so the only thing a client ever holds is a URL that stops
 * working when their session does.
 *
 * Admins may read any member's document; a member may read only their own.
 */
export const GET = async (request: Request) => {
  const url = new URL(request.url);
  const documentType = url.searchParams.get('type');
  const requestedPartnerId = url.searchParams.get('partnerId');

  if (!documentType) {
    return NextResponse.json({ error: 'Missing type' }, { status: 400 });
  }

  const [user] = await tryCatch(getCurrentUser());

  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const isAdmin = user.role === 'admin';

  /*
    A member's own partner is resolved from the session, never taken from the
    query string. Trusting partnerId from the caller would turn this route
    into a way to read anyone's ID by guessing a uuid.
  */
  const ownPartner = isAdmin
    ? null
    : await resolvePartnerForUser(
        user.id,
        [...STOCK_OWNER_PARTNER_TYPES],
        user.partnerId,
      );

  const partnerId = isAdmin ? requestedPartnerId : (ownPartner?.id ?? null);

  if (!partnerId) {
    return NextResponse.json({ error: 'Not permitted' }, { status: 403 });
  }

  const [document] = await db
    .select()
    .from(partnerIdentityDocuments)
    .where(
      and(
        eq(partnerIdentityDocuments.partnerId, partnerId),
        eq(partnerIdentityDocuments.documentType, documentType),
      ),
    )
    .limit(1);

  if (!document) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // The stored URL is fetched server-side, so it must be one of ours.
  if (!isVercelBlobUrl(document.fileUrl)) {
    return NextResponse.json({ error: 'Unavailable' }, { status: 500 });
  }

  const [response] = await tryCatch(fetch(document.fileUrl));

  if (!response?.ok || !response.body) {
    return NextResponse.json({ error: 'Unavailable' }, { status: 502 });
  }

  /*
    The filename came from whoever uploaded it and is interpolated into a
    response header, so a name containing CR or LF would let the uploader append
    headers of their own. Stripping quotes was not enough. Everything outside a
    conservative set is replaced for the plain parameter, and the real name is
    carried in the RFC 5987 form where it is percent-encoded anyway.
  */
  const safeName =
    document.fileName.replace(/[^A-Za-z0-9._ -]/g, '_').slice(0, 120) ||
    'document';

  return new NextResponse(response.body, {
    headers: {
      'Content-Type': document.mimeType,
      'Content-Disposition': `inline; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
      /* Never cached by a proxy, and not left in the browser's disk cache. */
      'Cache-Control': 'private, no-store, max-age=0',
      /*
        The type is taken from sniffing the bytes at upload and is one of four
        we allow, but saying so stops a browser deciding for itself that a
        government ID is something it should execute.
      */
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
};
