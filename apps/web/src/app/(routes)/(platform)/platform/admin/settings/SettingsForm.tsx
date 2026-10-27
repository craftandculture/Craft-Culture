'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Divider from '@/app/_ui/components/Divider/Divider';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

/**
 * Form for managing platform settings
 *
 * Allows admin users to configure:
 * - Lead time minimum and maximum (days)
 *
 * The Google Sheet inventory sync that lived here was retired in October 2026:
 * Stock Explorer is the inventory, no sheet was set, and its Sync Now deleted
 * product offers as part of every run.
 *
 * @example
 *   <SettingsForm />
 */
const SettingsForm = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  // Fetch current settings
  const { data: leadTimeMinData } = useQuery(
    api.admin.settings.get.queryOptions({ key: 'leadTimeMin' }),
  );
  const { data: leadTimeMaxData } = useQuery(
    api.admin.settings.get.queryOptions({ key: 'leadTimeMax' }),
  );

  // What the user has typed; undefined means "show the saved value". Seeding
  // state from the query during render reset every keystroke back to the
  // saved value, so the fields could not be edited.
  const [leadTimeMinInput, setLeadTimeMin] = useState<number | undefined>();
  const [leadTimeMaxInput, setLeadTimeMax] = useState<number | undefined>();

  const leadTimeMin = leadTimeMinInput ?? (leadTimeMinData ? Number(leadTimeMinData) : 14);
  const leadTimeMax = leadTimeMaxInput ?? (leadTimeMaxData ? Number(leadTimeMaxData) : 21);

  // Mutations for updating settings
  const { mutateAsync: updateLeadTimeMinAsync, isPending: isUpdatingMin } =
    useMutation(api.admin.settings.update.mutationOptions());
  const { mutateAsync: updateLeadTimeMaxAsync, isPending: isUpdatingMax } =
    useMutation(api.admin.settings.update.mutationOptions());

  const handleSave = async () => {
    if (
      !Number.isFinite(leadTimeMin) ||
      !Number.isFinite(leadTimeMax) ||
      leadTimeMin < 0 ||
      leadTimeMax < leadTimeMin
    ) {
      toast.error('Enter a minimum and a maximum, with the maximum not below the minimum');
      return;
    }

    try {
      await Promise.all([
      updateLeadTimeMinAsync({
        key: 'leadTimeMin',
        value: String(leadTimeMin),
      }),
      updateLeadTimeMaxAsync({
        key: 'leadTimeMax',
        value: String(leadTimeMax),
      }),
    ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save lead time');
      return;
    }

    // Refetch the saved settings, then show them rather than the typed values
    await queryClient.invalidateQueries({
      queryKey: api.admin.settings.get.queryKey(),
    });
    setLeadTimeMin(undefined);
    setLeadTimeMax(undefined);
    toast.success('Lead time saved');
  };

  const isSaving = isUpdatingMin || isUpdatingMax;

  return (
    <div className="space-y-6">
      <Divider />

      {/* Lead Time Section */}
      <div className="space-y-4">
        <div>
          <Typography variant="bodySm" className="font-semibold">
            Lead Time Configuration
          </Typography>
          <Typography variant="bodyXs" colorRole="muted">
            Set the estimated delivery time range displayed to customers
          </Typography>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="leadTimeMin">
              <Typography variant="bodyXs" colorRole="muted">
                Minimum (days)
              </Typography>
            </label>
            <Input
              id="leadTimeMin"
              type="number"
              value={leadTimeMin}
              onChange={(e) => setLeadTimeMin(Number(e.target.value))}
              min={1}
              max={leadTimeMax}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="leadTimeMax">
              <Typography variant="bodyXs" colorRole="muted">
                Maximum (days)
              </Typography>
            </label>
            <Input
              id="leadTimeMax"
              type="number"
              value={leadTimeMax}
              onChange={(e) => setLeadTimeMax(Number(e.target.value))}
              min={leadTimeMin}
              className="w-full"
            />
          </div>
        </div>

        <Typography variant="bodyXs" colorRole="muted" className="italic">
          Customers will see: &quot;{leadTimeMin}-{leadTimeMax} days via air freight, EX-Works UAE(In-Bond)&quot;
        </Typography>
      </div>

      <Divider />

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          variant="default"
          colorRole="brand"
          onClick={handleSave}
          isDisabled={isSaving}
        >
          <ButtonContent>{isSaving ? 'Saving...' : 'Save Settings'}</ButtonContent>
        </Button>
      </div>
    </div>
  );
};

export default SettingsForm;
