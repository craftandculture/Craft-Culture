import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { users } from '@/database/schema';

import findLiveInvite from './findLiveInvite';

/**
 * What the join page may say about an invite, before anyone is signed in
 *
 * Only the first name and who sent it — enough to greet them, nothing that
 * would matter if a link were forwarded. The email is used to prefill the form
 * so they sign in as the account that was created for them.
 *
 * @param token - The token from the invite link
 * @returns The greeting, or null for an unknown or expired invite
 */
const getInviteGreeting = async (token: string) => {
  const invite = await findLiveInvite(token);
  if (!invite) return null;

  const [inviter] = invite.invitedBy
    ? await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, invite.invitedBy))
        .limit(1)
    : [];

  return {
    name: invite.name,
    inviterName: inviter?.name ?? null,
    email: invite.email,
  };
};

export default getInviteGreeting;
