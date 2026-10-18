import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { partnerIdentityDocuments, partners } from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

import ensureClientCode from '../data/ensureClientCode';

/**
 * The member's own account details
 *
 * Identity documents come back as facts about what is on file — type, name,
 * when it was uploaded — and never as URLs. Blob storage has no private tier,
 * so a URL handed to a browser is a permanent unauthenticated link to a
 * government ID. Viewing goes through /api/cellar/identity instead, which
 * checks who is asking.
 */
const memberGetProfile = stockOwnerProcedure.query(async ({ ctx }) => {
  const [partner] = await db
    .select({
      name: partners.businessName,
      email: partners.businessEmail,
      phone: partners.businessPhone,
      deliveryAddress: partners.deliveryAddress,
      deliveryInstructions: partners.deliveryInstructions,
      eidNumber: partners.eidNumber,
      eidExpiry: partners.eidExpiry,
    })
    .from(partners)
    .where(eq(partners.id, ctx.partner.id))
    .limit(1);

  /*
    Someone the cellar is shared with sees the contact and delivery details
    they need to act on the holder's behalf, and nothing about the holder's
    identity documents — not even that they exist.
  */
  const isHolder = ctx.cellarRole === 'holder';

  const documents = !isHolder
    ? []
    : await db
    .select({
      documentType: partnerIdentityDocuments.documentType,
      fileName: partnerIdentityDocuments.fileName,
      mimeType: partnerIdentityDocuments.mimeType,
      uploadedAt: partnerIdentityDocuments.createdAt,
    })
    .from(partnerIdentityDocuments)
    .where(eq(partnerIdentityDocuments.partnerId, ctx.partner.id));

  return {
    name: partner?.name ?? null,
    email: partner?.email ?? null,
    phone: partner?.phone ?? null,
    deliveryAddress: partner?.deliveryAddress ?? null,
    deliveryInstructions: partner?.deliveryInstructions ?? null,
    eidNumber: isHolder ? (partner?.eidNumber ?? null) : null,
    eidExpiry: isHolder ? (partner?.eidExpiry ?? null) : null,
    documents,
    /** The member's cellar reference, quoted on wine sent to our UK bond */
    reference: await ensureClientCode(ctx.partner.id),
    cellarRole: ctx.cellarRole,
  };
});

export default memberGetProfile;
