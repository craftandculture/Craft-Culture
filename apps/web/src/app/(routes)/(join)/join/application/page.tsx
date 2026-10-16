import { redirect } from 'next/navigation';

import getCurrentUser from '@/app/_auth/data/getCurrentUser';
import ApplicationWizard from '@/app/_onboarding/components/ApplicationWizard';

export const metadata = {
  title: 'Your application — Private Cellar',
};

interface ApplicationPageProps {
  searchParams: Promise<{ invite?: string; edit?: string }>;
}

/**
 * The Private Cellar application, for whoever is signed in
 *
 * Signed out, they go back to the front door with the invite kept.
 */
const ApplicationPage = async ({ searchParams }: ApplicationPageProps) => {
  const { invite, edit } = await searchParams;

  const user = await getCurrentUser();
  if (!user) {
    redirect(invite ? `/join?invite=${encodeURIComponent(invite)}` : '/join');
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <ApplicationWizard invite={invite ?? null} isEditing={edit === '1'} />
    </div>
  );
};

export default ApplicationPage;
