import { TRPCError } from '@trpc/server';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrderDocuments, users } from '@/database/schema';
import { approvedProcedure } from '@/lib/trpc/procedures';

import resolveOrderParty from '../utils/resolveOrderParty';

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
  const isAdmin = party === 'staff';
  const isPartner = party === 'partner';

  if (!party) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have access to this order',
    });
  }

  // Determine which document types the user can see based on their role
  // - Admin: all documents (full visibility)
  // - Partner: partner_invoice (their own), distributor_invoice (to pay), payment_proof, proof_of_delivery
  // - Distributor: distributor_invoice (their own), payment_proof, proof_of_delivery only
  // - partner_sales_order is the partner's own SO, priced like their invoice: admin + partner only
  // CRITICAL: Partner invoices should NEVER be visible to distributors (reveals partner costs/margins)
  let allowedDocTypes: ('partner_invoice' | 'cc_invoice' | 'distributor_invoice' | 'payment_proof' | 'proof_of_delivery' | 'partner_sales_order')[];

  if (isAdmin) {
    // Admin sees everything
    allowedDocTypes = ['partner_invoice', 'partner_sales_order', 'cc_invoice', 'distributor_invoice', 'payment_proof', 'proof_of_delivery'];
  } else if (isPartner) {
    // Partner sees their invoice, distributor invoice (to pay), payment proofs, and proof of delivery
    allowedDocTypes = ['partner_invoice', 'partner_sales_order', 'distributor_invoice', 'payment_proof', 'proof_of_delivery'];
  } else {
    // Distributor - can only see their own invoice, payment proofs, and proof of delivery
    // NEVER show partner_invoice (protects partner pricing/margins)
    allowedDocTypes = ['distributor_invoice', 'payment_proof', 'proof_of_delivery'];
  }

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

  return documents;
});

export default documentsGetMany;
