import { redirect } from 'next/navigation';

import getCurrentUser from '@/app/_auth/data/getCurrentUser';
import ApplicationStatus from '@/app/_onboarding/components/ApplicationStatus';

export const metadata = {
  title: 'Your application — Private Cellar',
};

/** Where a submitted Private Cellar application stands */
const ApplicationStatusPage = async () => {
  const user = await getCurrentUser();
  if (!user) redirect('/join');

  return (
    <div className="mx-auto w-full max-w-xl">
      <ApplicationStatus />
    </div>
  );
};

export default ApplicationStatusPage;
