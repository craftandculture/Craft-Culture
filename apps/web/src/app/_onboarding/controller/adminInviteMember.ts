import { TRPCError } from '@trpc/server';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import logAdminActivity from '@/app/_admin/utils/logAdminActivity';
import db from '@/database/client';
import { cellarApplications, cellarInvites, users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import ensureApplicantCellar from '../data/ensureApplicantCellar';
import getOrCreateApplication from '../data/getOrCreateApplication';
import sendInvite from '../data/sendInvite';
import newInviteToken from '../utils/newInviteToken';

/**
 * Invite someone to Private Cellar — their account and cellar made up front
 *
 * The account is created here, approved, so when they sign in with the link
 * Better Auth finds an existing user: none of the sign-up hooks run, no
 * "new sign-up" alert fires, and nothing in the shared sign-in code changes.
 *
 * Someone who already has an account (often an old sign-up still pending)
 * keeps it; their cellar is attached to it, and they are approved when they
 * accept. One live invitation per email: inviting again replaces the last.
 */
const adminInviteMember = adminProcedure
  .input(
    z.object({
      name: z.string().trim().min(2).max(120),
      email: z.string().trim().toLowerCase().email(),
      phone: z
        .string()
        .trim()
        .max(40)
        .transform((value) => value || null),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const [existing] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${input.email}`)
      .limit(1);

    if (existing?.role === 'admin') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'That is a staff account.' });
    }

    const user =
      existing ??
      (
        await db
          .insert(users)
          .values({
            id: crypto.randomUUID(),
            email: input.email,
            name: input.name,
            customerType: 'private_clients',
            role: 'user',
            approvalStatus: 'approved',
            approvedAt: new Date(),
            approvedBy: ctx.user.id,
            emailVerified: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning()
      )[0]!;

    const application = await getOrCreateApplication(user.id, input.name);

    if (application.status === 'declined') {
      await db
        .update(cellarApplications)
        .set({ status: 'draft', declineReason: null, decidedAt: null, decidedBy: null })
        .where(eq(cellarApplications.id, application.id));
    }

    const partnerId = await ensureApplicantCellar({
      application,
      userId: user.id,
      email: user.email,
      status: user.approvalStatus === 'approved' ? 'active' : 'inactive',
    });

    const { token, tokenHash, expiresAt } = newInviteToken();

    const invite = await db.transaction(async (tx) => {
      await tx
        .update(cellarInvites)
        .set({ status: 'revoked' })
        .where(and(sql`lower(${cellarInvites.email}) = ${input.email}`, eq(cellarInvites.status, 'sent')));

      const [created] = await tx
        .insert(cellarInvites)
        .values({
          email: input.email,
          name: input.name,
          phone: input.phone,
          tokenHash,
          status: 'sent',
          userId: user.id,
          partnerId,
          invitedBy: ctx.user.id,
          expiresAt,
          lastSentAt: new Date(),
        })
        .returning();

      await tx
        .update(cellarApplications)
        .set({
          inviteId: created!.id,
          fullName: application.fullName ?? input.name,
          phone: application.phone ?? input.phone,
        })
        .where(eq(cellarApplications.id, application.id));

      return created!;
    });

    const sent = await sendInvite({
      token,
      email: input.email,
      name: input.name,
      inviterName: ctx.user.name,
      expiresAt,
    });

    await logAdminActivity({
      adminId: ctx.user.id,
      action: 'cellar_invite.sent',
      entityType: 'cellar_invite',
      entityId: invite.id,
      metadata: { email: input.email, existingAccount: Boolean(existing) },
    });

    return { ...sent, existingAccount: Boolean(existing) };
  });

export default adminInviteMember;
