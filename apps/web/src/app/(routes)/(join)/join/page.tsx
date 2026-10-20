import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import getCurrentUser from '@/app/_auth/data/getCurrentUser';
import JoinStartForm from '@/app/_onboarding/components/JoinStartForm';
import getInviteGreeting from '@/app/_onboarding/data/getInviteGreeting';
import clientConfig from '@/client.config';

interface JoinPageProps {
  searchParams: Promise<{ invite?: string }>;
}

const DESCRIPTION = 'Your collection, held under bond at 12–16°C and delivered whenever you wish.';

/**
 * How a /join link reads when it is shared, in WhatsApp or anywhere else
 *
 * An invite link greets the person by first name and says who invited them;
 * nothing else about the invite is put in the preview, since a link can be
 * forwarded. The image is `opengraph-image.jpg` beside this page. The base
 * address is set here so the image URL is absolute, which WhatsApp needs.
 */
export const generateMetadata = async ({ searchParams }: JoinPageProps): Promise<Metadata> => {
  const { invite } = await searchParams;
  const greeting = invite ? await getInviteGreeting(invite).catch(() => null) : null;
  const firstName = greeting?.name?.trim().split(/\s+/)[0];

  const title = firstName ? `${firstName}, your private cellar is ready` : 'Your private cellar with Craft & Culture';
  const description = greeting?.inviterName
    ? `Personally invited by ${greeting.inviterName}. ${DESCRIPTION}`
    : DESCRIPTION;

  return {
    metadataBase: clientConfig.appUrl,
    title: { absolute: title },
    description,
    openGraph: { siteName: 'Craft & Culture', title, description, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
    robots: invite ? { index: false, follow: false } : undefined,
  };
};

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
