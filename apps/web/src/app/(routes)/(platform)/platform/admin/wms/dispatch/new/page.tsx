'use client';

import {
  IconArrowLeft,
  IconLoader2,
  IconPlus,
  IconSearch,
  IconTruck,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

/**
 * Create new dispatch batch - select distributor
 */
const NewDispatchBatchPage = () => {
  const router = useRouter();
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDistributorId, setSelectedDistributorId] = useState<string | null>(null);

  // Fetch distributors
  const { data: partners, isLoading } = useQuery({
    ...api.partners.list.queryOptions({
      type: 'distributor',
    }),
  });

  // Create batch mutation
  const createMutation = useMutation({
    ...api.wms.admin.dispatch.create.mutationOptions(),
    onSuccess: (data) => {
      void queryClient.invalidateQueries();
      router.push(`/platform/admin/wms/dispatch/${data.batch.id}`);
    },
  });

  const handleCreate = () => {
    if (!selectedDistributorId) return;
    createMutation.mutate({ distributorId: selectedDistributorId });
  };

  const filteredDistributors = partners?.filter((partner) =>
    searchQuery
      ? partner.name?.toLowerCase().includes(searchQuery.toLowerCase())
      : true,
  );

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/platform/admin/wms/dispatch">
            <Button variant="ghost" size="sm">
              <Icon icon={IconArrowLeft} size="sm" />
            </Button>
          </Link>
          <div>
            <Typography variant="headingMd">New Dispatch Batch</Typography>
            <Typography variant="bodySm" colorRole="muted">
              Select a distributor to create a batch for
            </Typography>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Icon
            icon={IconSearch}
            size="sm"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search distributors..."
            className="w-full rounded-lg border border-border-primary bg-fill-primary py-2 pl-10 pr-4 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center p-12">
            <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
          </div>
        )}

        {/* Distributors List */}
        {!isLoading && (
          <div className="space-y-2">
            {filteredDistributors?.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Typography variant="headingSm" className="mb-2">
                    No Distributors Found
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    {searchQuery ? 'Try a different search' : 'Add distributors to get started'}
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              filteredDistributors?.map((distributor) => (
                <Card
                  key={distributor.id}
                  className={`cursor-pointer transition-all ${
                    selectedDistributorId === distributor.id
                      ? 'border-2 border-brand-500 ring-2 ring-brand-500/20'
                      : 'hover:border-border-brand'
                  }`}
                  onClick={() => setSelectedDistributorId(distributor.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-fill-brand/10">
                          <Icon icon={IconTruck} size="md" className="text-text-brand" />
                        </div>
                        <div>
                          <Typography variant="bodySm" className="font-semibold">
                            {distributor.name}
                          </Typography>
                        </div>
                      </div>
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                          selectedDistributorId === distributor.id
                            ? 'border-brand-500 bg-brand-500'
                            : 'border-border-primary'
                        }`}
                      >
                        {selectedDistributorId === distributor.id && (
                          <div className="h-2 w-2 rounded-full bg-white" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Create Button */}
        {selectedDistributorId && (
          <div className="fixed bottom-0 left-0 right-0 border-t border-border-primary bg-fill-primary p-4 sm:static sm:border-0 sm:bg-transparent sm:p-0">
            <Button
              variant="primary"
              className="w-full"
              onClick={handleCreate}
              disabled={createMutation.isPending}
            >
              <ButtonContent iconLeft={createMutation.isPending ? IconLoader2 : IconPlus}>
                {createMutation.isPending ? 'Creating...' : 'Create Batch'}
              </ButtonContent>
            </Button>
            {createMutation.isError && (
              <Typography variant="bodyXs" className="mt-2 text-center text-red-600">
                {createMutation.error?.message}
              </Typography>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NewDispatchBatchPage;
