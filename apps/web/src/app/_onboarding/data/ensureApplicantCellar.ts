import { and, eq, ne, sql } from 'drizzle-orm';

import normalisePartnerName from '@/app/_partners/utils/normalisePartnerName';
import db from '@/database/client';
import {
  type CellarApplication,
  cellarApplications,
  cellarIntakes,
  partnerMembers,
  partners,
} from '@/database/schema';

interface EnsureApplicantCellarParams {
  application: CellarApplication;
  userId: string;
  email: string;
  /** Status for a cellar created here — inactive until approval, active for invitees */
  status: 'active' | 'inactive';
}

/**
 * The collector record an application belongs to — found, never duplicated
 *
 * In order, so one person never ends up with two cellars:
 * 1. the one already on the application;
 * 2. a collector this user is already a member of;
 * 3. a collector on file under the same email (created by an admin before the
 *    person ever signed in) — the email is proven by the magic link, so this
 *    is the same person;
 * 4. otherwise a new collector.
 *
 * A collector with the same NAME is never joined — a name proves nothing — but
 * is recorded on the application for an admin to merge if it is genuine.
 *
 * @returns The collector's id
 */
const ensureApplicantCellar = async ({
  application,
  userId,
  email,
  status,
}: EnsureApplicantCellarParams) => {
  if (application.partnerId) return application.partnerId;

  const [member] = await db
    .select({ partnerId: partners.id })
    .from(partnerMembers)
    .innerJoin(partners, eq(partners.id, partnerMembers.partnerId))
    .where(
      and(eq(partnerMembers.userId, userId), eq(partners.type, 'private_collector')),
    )
    .limit(1);

  const [byEmail] = member
    ? []
    : await db
        .select({ partnerId: partners.id })
        .from(partners)
        .where(
          and(
            eq(partners.type, 'private_collector'),
            sql`lower(${partners.businessEmail}) = ${email.toLowerCase()}`,
          ),
        )
        .limit(1);

  const name = application.fullName?.trim() || email;

  const partnerId = await db.transaction(async (tx) => {
    let id = member?.partnerId ?? byEmail?.partnerId ?? null;

    if (!id) {
      const [created] = await tx
        .insert(partners)
        .values({
          type: 'private_collector',
          status,
          businessName: name,
          businessEmail: email,
          businessPhone: application.phone,
          deliveryAddress: application.deliveryAddress,
          eidNumber: application.eidNumber,
          eidExpiry: application.eidExpiry ? new Date(application.eidExpiry) : null,
          userId,
        })
        .returning({ id: partners.id });
      id = created!.id;
    }

    if (!member) {
      await tx
        .insert(partnerMembers)
        .values({ partnerId: id, userId, role: 'owner', addedBy: userId });
    }

    // Intakes saved before the cellar existed now belong to it
    await tx
      .update(cellarIntakes)
      .set({ partnerId: id })
      .where(eq(cellarIntakes.applicationId, application.id));

    await tx
      .update(cellarApplications)
      .set({ partnerId: id })
      .where(eq(cellarApplications.id, application.id));

    return id;
  });

  // Flag, never link, a different partner trading under the same name
  const key = normalisePartnerName(name);

  if (key) {
    const others = await db
      .select({ id: partners.id, businessName: partners.businessName })
      .from(partners)
      .where(ne(partners.id, partnerId));
    const match = others.find(
      (other) => normalisePartnerName(other.businessName) === key,
    );

    if (match) {
      await db
        .update(cellarApplications)
        .set({ duplicateOfPartnerId: match.id })
        .where(eq(cellarApplications.id, application.id));
    }
  }

  return partnerId;
};

export default ensureApplicantCellar;
