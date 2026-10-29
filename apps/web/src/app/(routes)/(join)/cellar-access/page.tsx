import getCurrentUser from '@/app/_auth/data/getCurrentUser';
import AcceptCellarAccess from '@/app/_cellar/components/AcceptCellarAccess';
import findAccessInvitation from '@/app/_cellar/data/findAccessInvitation';

export const metadata = {
  title: 'Private Cellar',
  robots: { index: false, follow: false },
};

interface CellarAccessPageProps {
  searchParams: Promise<{ token?: string }>;
}

/**
 * Where an invitation to share someone's private cellar lands
 *
 * In the sign-up frame rather than the platform, so a person who has not
 * been approved yet is not redirected away before they can accept.
 */
const CellarAccessPage = async ({ searchParams }: CellarAccessPageProps) => {
  const { token } = await searchParams;
  const invitation = token ? await findAccessInvitation(token) : null;

  if (!token || !invitation) {
    return (
      <div className="bg-fill-primary border-border-muted mx-auto max-w-md rounded-2xl border p-7 text-center shadow-sm">
        <h1 className="font-heading text-text-primary text-2xl">
          This invitation is no longer valid
        </h1>
        <p className="text-text-muted mt-2 text-sm leading-6">
          It may have expired or been withdrawn. Please ask the person who
          invited you to send a new one.
        </p>
      </div>
    );
  }

  const user = await getCurrentUser();
  const { grant, holderName } = invitation;

  return (
    <AcceptCellarAccess
      token={token}
      holderName={holderName}
      inviteeName={grant.name}
      inviteeEmail={grant.email}
      level={grant.role === 'manager' ? 'manager' : 'viewer'}
      signedInAs={user?.email ?? null}
    />
  );
};

export default CellarAccessPage;
