import { desc, eq, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import db from '@/database/client';
import {
  cellarApplications,
  cellarIntakes,
  partnerIdentityDocuments,
  partners,
  users,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import missingProfileItems from '../utils/missingProfileItems';

/**
 * Every Private Cellar application, newest first
 *
 * Drafts are included only once a name has been saved — opening the form
 * creates one, and an empty draft is nobody to follow up. Each row carries
 * what is missing, the wine sources and any possible duplicate, which is
 * everything needed to decide without opening another screen.
 */
const adminListApplications = adminProcedure.query(async () => {
  const duplicate = alias(partners, 'duplicate');

  const rows = await db
    .select({
      application: cellarApplications,
      email: users.email,
      userName: users.name,
      approvalStatus: users.approvalStatus,
      duplicateName: duplicate.businessName,
    })
    .from(cellarApplications)
    .innerJoin(users, eq(users.id, cellarApplications.userId))
    .leftJoin(duplicate, eq(duplicate.id, cellarApplications.duplicateOfPartnerId))
    .orderBy(desc(cellarApplications.updatedAt));

  const shown = rows.filter(
    (row) => row.application.status !== 'draft' || row.application.fullName,
  );
  const ids = shown.map((row) => row.application.id);
  const partnerIds = shown
    .map((row) => row.application.partnerId)
    .filter((id): id is string => Boolean(id));

  const [intakes, documents] = await Promise.all([
    ids.length
      ? db.select().from(cellarIntakes).where(inArray(cellarIntakes.applicationId, ids))
      : Promise.resolve([]),
    partnerIds.length
      ? db
          .select({
            partnerId: partnerIdentityDocuments.partnerId,
            documentType: partnerIdentityDocuments.documentType,
          })
          .from(partnerIdentityDocuments)
          .where(inArray(partnerIdentityDocuments.partnerId, partnerIds))
      : Promise.resolve([]),
  ]);

  return shown.map(({ application, ...row }) => {
    const documentTypes = documents
      .filter((document) => document.partnerId === application.partnerId)
      .map((document) => document.documentType);

    return {
      ...row,
      application,
      documentTypes,
      intakes: intakes.filter((intake) => intake.applicationId === application.id),
      missing: missingProfileItems({
        phone: application.phone,
        deliveryAddress: application.deliveryAddress,
        eidNumber: application.eidNumber,
        documentTypes,
      }),
    };
  });
});

export default adminListApplications;
