'use client';

import { SelectTrigger } from '@radix-ui/react-select';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import Select from '@/app/_ui/components/Select/Select';
import SelectContent from '@/app/_ui/components/Select/SelectContent';
import SelectItem from '@/app/_ui/components/Select/SelectItem';
import SelectItemContent from '@/app/_ui/components/Select/SelectItemContent';
import SelectTriggerContent from '@/app/_ui/components/Select/SelectTriggerContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

const UsersWithPricingModelsList = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const { data: users } = useSuspenseQuery(
    api.users.getManyWithPricingModels.queryOptions(),
  );

  const { data: pricingModels } = useSuspenseQuery(
    api.pricingModels.getMany.queryOptions(),
  );

  const { mutateAsync: assignPricingModel } = useMutation(
    api.users.assignPricingModel.mutationOptions({
      onSuccess: () => {
        toast.success('Pricing model assigned');
        void queryClient.invalidateQueries({
          queryKey: [['users', 'getManyWithPricingModels']],
        });
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const handleAssign = async (
    userId: string,
    pricingModelId: string | null,
  ) => {
    await assignPricingModel({
      userId,
      pricingModelId,
    });
  };

  if (users.length === 0) {
    return (
      <Typography variant="bodySm" className="text-text-muted">
        No users found.
      </Typography>
    );
  }

  return (
    <div className="space-y-3">
      {users.map((user) => (
        <div
          key={user.id}
          className="border-border-primary flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex-1">
            <Typography variant="bodyMd" className="font-medium">
              {user.name}
            </Typography>
            <Typography variant="bodySm" className="text-text-muted">
              {user.email} • {user.customerType}
            </Typography>
          </div>
          <div className="sm:w-64">
            <Select
              value={user.pricingModelId ?? 'none'}
              onValueChange={(value) =>
                handleAssign(user.id, value === 'none' ? null : value)
              }
            >
              <SelectTrigger asChild>
                <Button className="w-full">
                  <SelectTriggerContent />
                </Button>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <SelectItemContent>Default (First Active)</SelectItemContent>
                </SelectItem>
                {pricingModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <SelectItemContent>{model.name}</SelectItemContent>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ))}
    </div>
  );
};

export default UsersWithPricingModelsList;
