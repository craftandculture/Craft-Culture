import { TRPCError } from '@trpc/server';
import { del } from '@vercel/blob';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import logAdminActivity from '@/app/_admin/utils/logAdminActivity';
import db from '@/database/client';
import {
  cellarApplications,
  cellarIntakes,
  cellarMemberships,
  partnerIdentityDocuments,
  partnerMembers,
  partners,
} from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

/**
 * Join an applicant to the existing collector their name matched
 *
 * Name matches are never joined automatically — a name proves nothing — so
 * this is the admin confirming it is the same person. The applicant becomes
 * an owner of the existing cellar; their ID photos and wine answers move with
 * them, a fresh photo replacing an older one of the same side.
 *
 * The cellar created for the application is retired, not deleted, so any
 * stale reference still resolves. Only a cellar that is not yet active can be
 * retired this way: an active one may already hold stock, and merging that is
 * the Partners screen's full merge.
 */
const adminMergeApplication = staffAdminProcedure
  .input(z.object({ applicationId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const [application] = await db
      .select()
      .from(cellarApplications)
      .where(eq(cellarApplications.id, input.applicationId))
      .limit(1);

    if (!application) throw new TRPCError({ code: 'NOT_FOUND', message: 'Application not found' });

    const targetId = application.duplicateOfPartnerId;
    if (!targetId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No matching collector to merge into' });
    }

    const [target] = await db.select().from(partners).where(eq(partners.id, targetId)).limit(1);
    if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'The matched collector no longer exists' });

    /*
      Only ever into a private cellar. The name match runs across every
      partner, so it can point at a trade partner or distributor — and merging
      would make the applicant an owner of that business.
    */
    if (target.type !== 'private_collector') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `${target.businessName} is not a private cellar, so this application cannot be merged into it.`,
      });
    }

    const ownId = application.partnerId && application.partnerId !== targetId ? application.partnerId : null;
    const [own] = ownId
      ? await db.select().from(partners).where(eq(partners.id, ownId)).limit(1)
      : [];

    if (own?.status === 'active') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `${own.businessName} is already active. Merge the two on the Partners screen instead.`,
      });
    }

    const replacedUrls: string[] = [];

    await db.transaction(async (tx) => {
      if (own) {
        const moving = await tx
          .select()
          .from(partnerIdentityDocuments)
          .where(eq(partnerIdentityDocuments.partnerId, own.id));
        const sides = moving.map((document) => document.documentType);

        if (sides.length) {
          const replaced = await tx
            .delete(partnerIdentityDocuments)
            .where(
              and(
                eq(partnerIdentityDocuments.partnerId, targetId),
                inArray(partnerIdentityDocuments.documentType, sides),
              ),
            )
            .returning({ fileUrl: partnerIdentityDocuments.fileUrl });
          replacedUrls.push(...replaced.map((document) => document.fileUrl));

          await tx
            .update(partnerIdentityDocuments)
            .set({ partnerId: targetId })
            .where(eq(partnerIdentityDocuments.partnerId, own.id));
        }

        await tx.update(cellarIntakes).set({ partnerId: targetId }).where(eq(cellarIntakes.partnerId, own.id));
        /*
          The membership follows the person. Deleting it lost an active
          member's status and start date; it moves to the target unless the
          target already has one, which then stands.
        */
        const [targetMembership] = await tx
          .select({ id: cellarMemberships.id })
          .from(cellarMemberships)
          .where(eq(cellarMemberships.partnerId, targetId))
          .limit(1);

        if (targetMembership) {
          await tx.delete(cellarMemberships).where(eq(cellarMemberships.partnerId, own.id));
        } else {
          await tx
            .update(cellarMemberships)
            .set({ partnerId: targetId })
            .where(eq(cellarMemberships.partnerId, own.id));
        }
        await tx
          .delete(partnerMembers)
          .where(and(eq(partnerMembers.partnerId, own.id), eq(partnerMembers.userId, application.userId)));
        await tx
          .update(partners)
          .set({
            status: 'inactive',
            userId: null,
            businessName: `${own.businessName} (merged into ${target.businessName})`,
          })
          .where(eq(partners.id, own.id));
      }

      const [link] = await tx
        .select({ id: partnerMembers.id })
        .from(partnerMembers)
        .where(and(eq(partnerMembers.partnerId, targetId), eq(partnerMembers.userId, application.userId)))
        .limit(1);
      if (!link) {
        await tx
          .insert(partnerMembers)
          .values({ partnerId: targetId, userId: application.userId, role: 'owner', addedBy: ctx.user.id });
      }

      await tx
        .update(cellarIntakes)
        .set({ partnerId: targetId })
        .where(eq(cellarIntakes.applicationId, application.id));
      await tx
        .update(cellarApplications)
        .set({ partnerId: targetId, duplicateOfPartnerId: null })
        .where(eq(cellarApplications.id, application.id));

      if (application.status === 'approved') {
        await tx.update(partners).set({ status: 'active' }).where(eq(partners.id, targetId));
      }
    });

    // Older photos the new ones replaced — best effort, the rows are already gone
    if (replacedUrls.length) {
      await del(replacedUrls).catch((error: unknown) =>
        logger.error('Could not delete replaced identity files after merge', { error }),
      );
    }

    await logAdminActivity({
      adminId: ctx.user.id,
      action: 'cellar_application.merged',
      entityType: 'cellar_application',
      entityId: application.id,
      metadata: { into: targetId, retired: own?.id ?? null },
    });

    return { partnerId: targetId };
  });

export default adminMergeApplication;
