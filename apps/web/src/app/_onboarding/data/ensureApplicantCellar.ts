import { and, asc, eq, ne, sql } from 'drizzle-orm';

import getCellarRole from '@/app/_cellar/data/getCellarRole';
import normalisePartnerName from '@/app/_partners/utils/normalisePartnerName';
import db from '@/database/client';
import {
  type CellarApplication,
  cellarApplications,
  cellarIntakes,
  cellarMemberships,
  partnerMembers,
  partners,
} from '@/database/schema';

import assertApplicationHolder from './assertApplicationHolder';

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
 * 2. a collector this user already HOLDS (owner, not a shared-access delegate);
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
  if (application.partnerId) {
    await assertApplicationHolder(application, userId);
    return application.partnerId;
  }

  /*
    Only a cellar this person HOLDS. Someone a cellar has been shared with is
    a member of it too (as a manager or viewer, or with access since revoked),
    and reusing that membership attached their application to the holder's
    cellar — so their answers overwrote the holder's profile and Emirates ID.
  */
  const owned = await db
    .select({ partnerId: partners.id })
    .from(partnerMembers)
    .innerJoin(partners, eq(partners.id, partnerMembers.partnerId))
    .where(
      and(
        eq(partnerMembers.userId, userId),
        eq(partnerMembers.role, 'owner'),
        eq(partners.type, 'private_collector'),
      ),
    )
    .orderBy(asc(partnerMembers.createdAt), asc(partners.id));

  let member: { partnerId: string } | undefined;
  for (const candidate of owned) {
    if ((await getCellarRole(candidate.partnerId, userId)) === 'holder') {
      member = candidate;
      break;
    }
  }

  const emailMatches = member
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
        .orderBy(asc(partners.createdAt), asc(partners.id));

  // The same rule for a cellar found by email: never one shared with them
  let byEmail: { partnerId: string } | undefined;
  for (const candidate of emailMatches) {
    if ((await getCellarRole(candidate.partnerId, userId)) === 'holder') {
      byEmail = candidate;
      break;
    }
  }

  // Already a member of the cellar found by email (in some role): no new link
  const [existingLink] =
    !member && byEmail
      ? await db
          .select({ role: partnerMembers.role })
          .from(partnerMembers)
          .where(
            and(
              eq(partnerMembers.userId, userId),
              eq(partnerMembers.partnerId, byEmail.partnerId),
            ),
          )
          .limit(1)
      : [];

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

      // A cellar opened through the journey is activated on its first action
      await tx.insert(cellarMemberships).values({ partnerId: id }).onConflictDoNothing();
    }

    if (!member && !existingLink) {
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
