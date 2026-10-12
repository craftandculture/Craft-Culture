import { redirect } from 'next/navigation';

import getCurrentUser from '@/app/_auth/data/getCurrentUser';
import JoinStartForm from '@/app/_onboarding/components/JoinStartForm';
import getInviteGreeting from '@/app/_onboarding/data/getInviteGreeting';

export const metadata = {
  title: 'Join Private Cellar — Craft & Culture',
};

interface JoinPageProps {
  searchParams: Promise<{ invite?: string }>;
}

/**
 * Private Cellar sign-up — the public front door
 *
 * Someone already signed in goes straight to their application.
 */
const JoinPage = async ({ searchParams }: JoinPageProps) => {
  const { invite } = await searchParams;
  const suffix = invite ? `?invite=${encodeURIComponent(invite)}` : '';

  const user = await getCurrentUser();
  if (user) redirect(`/join/application${suffix}`);

  const greeting = invite ? await getInviteGreeting(invite) : null;

  return <JoinStartForm invite={invite ?? null} greeting={greeting} />;
};

export default JoinPage;
