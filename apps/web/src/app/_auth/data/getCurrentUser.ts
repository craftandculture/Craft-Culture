import parse from 'another-name-parser';
import { headers } from 'next/headers';
import { cache } from 'react';

import { User } from '@/database/schema';
import authServerClient from '@/lib/better-auth/server';

const getCurrentUser = cache(async () => {
  const session = await authServerClient.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return null;
  }

  return {
    ...session.user,
    firstName: parse(session.user.name).first,
    lastName: parse(session.user.name).last,
  } as unknown as User & {
    firstName: string | null;
    lastName: string | null;
  };
});

export default getCurrentUser;
