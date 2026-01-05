import parse from 'another-name-parser';
import { eq } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';

import clientConfig from '@/client.config';
import db from '@/database/client';
import { User, sessions, users } from '@/database/schema';
import authServerClient from '@/lib/better-auth/server';

export interface CurrentUser extends User {
  firstName: string | null;
  lastName: string | null;
  isImpersonated: boolean;
  impersonatedBy: string | null;
  impersonatingAdmin: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await authServerClient.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return null;
  }

  // Check if this is an impersonation session
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(
    `${clientConfig.cookiePrefix}.session_token`,
  )?.value;

  let isImpersonated = false;
  let impersonatedBy: string | null = null;
  let impersonatingAdmin: CurrentUser['impersonatingAdmin'] = null;

  if (sessionToken) {
    // Look up the session in the database to check for impersonation
    const [dbSession] = await db
      .select({
        impersonatedBy: sessions.impersonatedBy,
      })
      .from(sessions)
      .where(eq(sessions.token, sessionToken))
      .limit(1);

    if (dbSession?.impersonatedBy) {
      isImpersonated = true;
      impersonatedBy = dbSession.impersonatedBy;

      // Get the admin who is impersonating
      const [admin] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, dbSession.impersonatedBy))
        .limit(1);

      if (admin) {
        impersonatingAdmin = admin;
      }
    }
  }

  return {
    ...session.user,
    firstName: parse(session.user.name).first,
    lastName: parse(session.user.name).last,
    isImpersonated,
    impersonatedBy,
    impersonatingAdmin,
  } as CurrentUser;
});

export default getCurrentUser;
