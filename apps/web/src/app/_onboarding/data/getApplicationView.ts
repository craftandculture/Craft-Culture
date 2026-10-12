import { eq } from 'drizzle-orm';

import db from '@/database/client';
import {
  type CellarApplication,
  cellarIntakes,
  cellarInvites,
  partnerIdentityDocuments,
  users,
} from '@/database/schema';

import missingProfileItems from '../utils/missingProfileItems';

/**
 * Everything the application screens need, in one read
 *
 * Which ID sides are uploaded comes from the partner's documents, so a
 * re-visit shows "front ✓" rather than asking again.
 *
 * @param application - The application
 * @returns The application with its intakes, uploads, invite and gaps
 */
const getApplicationView = async (application: CellarApplication) => {
  const [intakes, documents, invite] = await Promise.all([
    db
      .select()
      .from(cellarIntakes)
      .where(eq(cellarIntakes.applicationId, application.id)),
    application.partnerId
      ? db
          .select({ documentType: partnerIdentityDocuments.documentType })
          .from(partnerIdentityDocuments)
          .where(eq(partnerIdentityDocuments.partnerId, application.partnerId))
      : Promise.resolve([]),
    application.inviteId
      ? db
          .select({
            name: cellarInvites.name,
            inviterName: users.name,
          })
          .from(cellarInvites)
          .leftJoin(users, eq(users.id, cellarInvites.invitedBy))
          .where(eq(cellarInvites.id, application.inviteId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
  ]);

  const documentTypes = documents.map((document) => document.documentType);

  return {
    application,
    intakes,
    documentTypes,
    invite,
    missing: missingProfileItems({
      phone: application.phone,
      deliveryAddress: application.deliveryAddress,
      eidNumber: application.eidNumber,
      documentTypes,
    }),
  };
};

export default getApplicationView;
