'use client';

import { IconTrash } from '@tabler/icons-react';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

const PricingModelsList = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const { data: pricingModels } = useSuspenseQuery(
    api.pricingModels.getMany.queryOptions(),
  );

  const { mutateAsync: deletePricingModel } = useMutation(
    api.pricingModels.delete.mutationOptions({
      onSuccess: () => {
        toast.success('Pricing model deleted');
        void queryClient.invalidateQueries({
          queryKey: [['pricingModels', 'getMany']],
        });
        void queryClient.invalidateQueries({
          queryKey: [['users', 'getManyWithPricingModels']],
        });
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this pricing model?')) {
      await deletePricingModel({ id });
    }
  };

  if (pricingModels.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {pricingModels.map((model) => (
        <div
          key={model.id}
          className="border-border-primary flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex-1">
            <Typography variant="bodyMd" className="font-medium">
              {model.name}
            </Typography>
            <Typography variant="bodySm" className="text-text-muted">
              Sheet: {model.sheet.googleSheetId} • Active:{' '}
              {model.isDefaultB2C ? 'Yes' : 'No'} • Created:{' '}
              {new Date(model.createdAt).toLocaleDateString()}
            </Typography>
          </div>
          <Button
            colorRole="danger"
            className="w-full sm:w-auto"
            onClick={() => handleDelete(model.id)}
          >
            <ButtonContent iconLeft={IconTrash}>Delete</ButtonContent>
          </Button>
        </div>
      ))}
    </div>
  );
};

export default PricingModelsList;
