'use client';

import { IconArrowLeft } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { use } from 'react';

import ClientContactForm from '@/app/_privateClientContacts/components/ClientContactForm';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import { useTRPCClient } from '@/lib/trpc/browser';

interface EditClientPageProps {
  params: Promise<{ clientId: string }>;
}

/**
 * Edit client contact page
 */
const EditClientPage = ({ params }: EditClientPageProps) => {
  const { clientId } = use(params);
  const trpcClient = useTRPCClient();

  const { data: contact, isLoading } = useQuery({
    queryKey: ['privateClientContacts.getOne', clientId],
    queryFn: () => trpcClient.privateClientContacts.getOne.query({ id: clientId }),
  });

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Typography variant="bodySm" colorRole="muted">
          Loading client...
        </Typography>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Typography variant="bodySm" colorRole="muted">
          Client not found
        </Typography>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <Link
          href={`/platform/clients/${clientId}`}
          className="mb-2 flex items-center gap-1 text-sm text-text-muted hover:text-text-primary"
        >
          <Icon icon={IconArrowLeft} size="sm" />
          Back to Client
        </Link>
        <Typography variant="headingLg">Edit Client</Typography>
        <Typography variant="bodySm" colorRole="muted">
          Update {contact.name}&apos;s information
        </Typography>
      </div>

      <ClientContactForm contact={contact} mode="edit" />
    </div>
  );
};

export default EditClientPage;
