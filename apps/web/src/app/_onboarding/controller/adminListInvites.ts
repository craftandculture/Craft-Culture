import { desc, eq } from 'drizzle-orm';

import db from '@/database/client';
import { cellarInvites, users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Every Private Cellar invitation, newest first
 *
 * An unaccepted invitation past its date reads as expired here; the row is
 * not rewritten, since resending brings it back.
 */
const adminListInvites = adminProcedure.query(async () => {
  const rows = await db
    .select({ invite: cellarInvites, inviterName: users.name })
    .from(cellarInvites)
    .leftJoin(users, eq(users.id, cellarInvites.invitedBy))
    .orderBy(desc(cellarInvites.createdAt));

  const now = new Date();

  return rows.map(({ invite, inviterName }) => ({
    id: invite.id,
    name: invite.name,
    email: invite.email,
    phone: invite.phone,
    inviterName,
    status: invite.status === 'sent' && invite.expiresAt < now ? 'expired' : invite.status,
    expiresAt: invite.expiresAt,
    lastSentAt: invite.lastSentAt,
    acceptedAt: invite.acceptedAt,
  }));
});

export default adminListInvites;
