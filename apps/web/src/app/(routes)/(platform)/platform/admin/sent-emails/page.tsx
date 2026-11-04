import SentEmailsFeed from '@/app/_admin/components/SentEmailsFeed';

/** Sent Emails: every email the app has sent, to check each release */
const SentEmailsPage = () => {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8">
      <SentEmailsFeed />
    </div>
  );
};

export default SentEmailsPage;
