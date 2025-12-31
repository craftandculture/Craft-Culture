import { IconArrowLeft } from '@tabler/icons-react';
import Link from 'next/link';

import ClientContactForm from '@/app/_privateClientContacts/components/ClientContactForm';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

export const metadata = {
  title: 'Add Client | Craft & Culture',
};

/**
 * Create new client contact page
 */
const NewClientPage = () => {
  return (
    <div className="container mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <Link
          href="/platform/clients"
          className="mb-2 flex items-center gap-1 text-sm text-text-muted hover:text-text-primary"
        >
          <Icon icon={IconArrowLeft} size="sm" />
          Back to Clients
        </Link>
        <Typography variant="h1">Add Client</Typography>
        <Typography variant="bodySm" colorRole="muted">
          Add a new private client to your CRM
        </Typography>
      </div>

      <ClientContactForm mode="create" />
    </div>
  );
};

export default NewClientPage;
