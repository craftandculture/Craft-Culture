import { TRPCError } from '@trpc/server';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  partnerMembers,
  privateClientOrderDocuments,
  users,
} from '@/database/schema';
import { approvedProcedure } from '@/lib/trpc/procedures';
import fileHref from '@/utils/fileHref';

import resolveOrderParty from '../utils/resolveOrderParty';
import visibleDocumentTypes from '../utils/visibleDocumentTypes';

const getDocumentsSchema = z.object({
  orderId: z.string().uuid(),
});

/**
 * Get all documents for a private client order
 *
 * Returns documents with uploader info, ordered by upload date descending.
 */
const documentsGetMany = approvedProcedure.input(getDocumentsSchema).query(async ({ input, ctx }) => {
  const { orderId } = input;
  const { user } = ctx;

  // Verify order exists and user has access
  const order = await db.query.privateClientOrders.findFirst({
    where: { id: orderId },
  });

  if (!order) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Order not found',
    });
  }

  // C&C staff, the partner who placed it, or its distributor
  const { party } = await resolveOrderParty(user, order);

  if (!party) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have access to this order',
    });
  }

  const allowedDocTypes = visibleDocumentTypes(party);

  // Get documents with uploader info, filtered by allowed document types
  const documents = await db
    .select({
      id: privateClientOrderDocuments.id,
      orderId: privateClientOrderDocuments.orderId,
      documentType: privateClientOrderDocuments.documentType,
      fileUrl: privateClientOrderDocuments.fileUrl,
      fileName: privateClientOrderDocuments.fileName,
      fileSize: privateClientOrderDocuments.fileSize,
      mimeType: privateClientOrderDocuments.mimeType,
      uploadedAt: privateClientOrderDocuments.uploadedAt,
      extractionStatus: privateClientOrderDocuments.extractionStatus,
      extractedData: privateClientOrderDocuments.extractedData,
      extractionError: privateClientOrderDocuments.extractionError,
      extractedAt: privateClientOrderDocuments.extractedAt,
      isMatched: privateClientOrderDocuments.isMatched,
      matchedAt: privateClientOrderDocuments.matchedAt,
      matchNotes: privateClientOrderDocuments.matchNotes,
      uploader: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
      // Only used below to decide whether the partner may see the uploader
      uploaderLegacyPartnerId: users.partnerId,
    })
    .from(privateClientOrderDocuments)
    .leftJoin(users, eq(privateClientOrderDocuments.uploadedBy, users.id))
    .where(
      and(
        eq(privateClientOrderDocuments.orderId, orderId),
        inArray(privateClientOrderDocuments.documentType, allowedDocTypes),
      ),
    )
    .orderBy(desc(privateClientOrderDocuments.uploadedAt));

  /*
    A partner never sees the people on the other side of the order. The
    distributor's documents are visible to them, and naming who uploaded one
    handed over a distributor colleague's name and email. A partner is shown
    the uploader only when it is one of their own people: a member of their
    partner account, or linked to it directly on the user record.
  */
  const ownUserIds =
    party === 'partner' && order.partnerId
      ? new Set(
          (
            await db
              .select({ userId: partnerMembers.userId })
              .from(partnerMembers)
              .where(eq(partnerMembers.partnerId, order.partnerId))
          ).map((member) => member.userId),
        )
      : null;

  // A private file opens through /api/files, never by its storage address
  return documents.map(({ uploaderLegacyPartnerId, ...document }) => {
    const uploaderIsOwn =
      !ownUserIds ||
      (document.uploader !== null &&
        (ownUserIds.has(document.uploader.id) ||
          (order.partnerId !== null &&
            uploaderLegacyPartnerId === order.partnerId)));

    return {
      ...document,
      uploader: uploaderIsOwn ? document.uploader : null,
      fileUrl: fileHref(document.fileUrl),
    };
  });
});

export default documentsGetMany;
