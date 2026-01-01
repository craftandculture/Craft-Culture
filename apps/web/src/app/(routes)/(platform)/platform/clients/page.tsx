import ClientContactsList from '@/app/_privateClientContacts/components/ClientContactsList';
import Typography from '@/app/_ui/components/Typography/Typography';

export const metadata = {
  title: 'Clients | Craft & Culture',
};

/**
 * Client CRM list page for wine partners
 */
const ClientsPage = () => {
  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div>
        <Typography variant="headingLg">Clients</Typography>
        <Typography variant="bodySm" colorRole="muted">
          Manage your private client relationships
        </Typography>
      </div>

      <ClientContactsList />
    </div>
  );
};

export default ClientsPage;
