import { redirect } from 'next/navigation';

import getUserOrRedirect from '@/app/_auth/data/getUserOrRedirect';

export const GET = async () => {
  const user = await getUserOrRedirect();

  if (user.onboardingStep === 'completed') {
    redirect('/dashboard');
  }

  redirect(`/onboarding/${user.onboardingStep}`);
};
