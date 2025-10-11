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

const SheetsList = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const { data: sheets } = useSuspenseQuery(api.sheets.getMany.queryOptions());

  const { mutateAsync: deleteSheet } = useMutation(
    api.sheets.delete.mutationOptions({
      onSuccess: () => {
        toast.success('Sheet deleted');
        void queryClient.invalidateQueries({
          queryKey: api.sheets.getMany.queryKey(),
        });
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this sheet?')) {
      await deleteSheet({ id });
    }
  };

  if (sheets.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {sheets.map((sheet) => (
        <div
          key={sheet.id}
          className="border-border-primary flex items-center justify-between rounded-lg border p-4"
        >
          <div className="flex-1">
            <Typography variant="bodyMd" className="font-medium">
              {sheet.name}
            </Typography>
            <Typography variant="bodySm" className="text-text-muted">
              Saved: {new Date(sheet.createdAt).toLocaleDateString()} • Last
              Updated: {new Date(sheet.updatedAt).toLocaleDateString()}
            </Typography>
          </div>
          <Button colorRole="danger" onClick={() => handleDelete(sheet.id)}>
            <ButtonContent iconLeft={IconTrash}>Delete</ButtonContent>
          </Button>
        </div>
      ))}
    </div>
  );
};

export default SheetsList;
