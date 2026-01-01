import ClientContactDetail from '@/app/_privateClientContacts/components/ClientContactDetail';

export const metadata = {
  title: 'Client Details | Craft & Culture',
};

interface ClientDetailPageProps {
  params: Promise<{ clientId: string }>;
}

/**
 * Client detail page showing contact info and order history
 */
const ClientDetailPage = async ({ params }: ClientDetailPageProps) => {
  const { clientId } = await params;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <ClientContactDetail clientId={clientId} />
    </div>
  );
};

export default ClientDetailPage;
