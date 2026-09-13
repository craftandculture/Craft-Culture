import ImpersonationBanner from '@/app/_auth/components/ImpersonationBanner';
import WelcomeForm from '@/app/_auth/components/WelcomeForm';
import getCurrentUser from '@/app/_auth/data/getCurrentUser';

/**
 * Onboarding, with a way back out of an impersonated session
 *
 * This page sits outside the platform layout, so it carried no impersonation
 * banner — and onboarding is exactly where an admin viewing a user who has
 * never signed in gets sent. A form that could not be completed therefore had
 * no exit either, and the only ways out were clearing cookies or waiting an
 * hour for the session to lapse.
 */
const Page = async () => {
  const user = await getCurrentUser();

  return (
    <>
      {user?.isImpersonated && (
        <ImpersonationBanner userName={user.name} userEmail={user.email} />
      )}
      <WelcomeForm />
    </>
  );
};

export default Page;
