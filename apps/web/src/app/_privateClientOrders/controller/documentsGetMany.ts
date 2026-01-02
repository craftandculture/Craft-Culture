import { TRPCError } from '@trpc/server';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { partnerMembers, privateClientOrderDocuments, users } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

const getDocumentsSchema = z.object({
  orderId: z.string().uuid(),
});

/**
 * Get all documents for a private client order
 *
 * Returns documents with uploader info, ordered by upload date descending.
 */
const documentsGetMany = protectedProcedure.input(getDocumentsSchema).query(async ({ input, ctx }) => {
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

  // Check access - must be admin, the partner who created it, or assigned distributor
  const isAdmin = user.role === 'admin';

  // Check if user is a member of any partner
  const [userPartnerMembership] = await db
    .select({ partnerId: partnerMembers.partnerId })
    .from(partnerMembers)
    .where(eq(partnerMembers.userId, user.id))
    .limit(1);

  const isPartner = userPartnerMembership && order.partnerId === userPartnerMembership.partnerId;
  const isDistributor = userPartnerMembership && order.distributorId === userPartnerMembership.partnerId;

  if (!isAdmin && !isPartner && !isDistributor) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have access to this order',
    });
  }

  // Get documents with uploader info
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
    })
    .from(privateClientOrderDocuments)
    .leftJoin(users, eq(privateClientOrderDocuments.uploadedBy, users.id))
    .where(eq(privateClientOrderDocuments.orderId, orderId))
    .orderBy(desc(privateClientOrderDocuments.uploadedAt));

  return documents;
});

export default documentsGetMany;
