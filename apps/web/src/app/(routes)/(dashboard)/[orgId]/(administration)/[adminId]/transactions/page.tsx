import TransactionsOverview from '@/app/_transactions/components/TransactionsOverview';

const Page = async (_: { params: Promise<{ adminId: string }> }) => {
  return <TransactionsOverview />;
};

export default Page;
