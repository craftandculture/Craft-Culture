import MemberEmailsAdmin from '@/app/_cellar/components/MemberEmailsAdmin';

/** Member Emails: the switch for Private Cellar emails, and the outbox */
const MemberEmailsPage = () => {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8">
      <MemberEmailsAdmin />
    </div>
  );
};

export default MemberEmailsPage;
