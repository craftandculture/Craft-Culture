'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

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
 * - Lead time minimum (days)
 * - Lead time maximum (days)
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

  // Local state for form inputs
  const [leadTimeMin, setLeadTimeMin] = useState<number>(
    leadTimeMinData ? Number(leadTimeMinData) : 14,
  );
  const [leadTimeMax, setLeadTimeMax] = useState<number>(
    leadTimeMaxData ? Number(leadTimeMaxData) : 21,
  );

  // Update state when data loads
  if (leadTimeMinData && leadTimeMin !== Number(leadTimeMinData)) {
    setLeadTimeMin(Number(leadTimeMinData));
  }
  if (leadTimeMaxData && leadTimeMax !== Number(leadTimeMaxData)) {
    setLeadTimeMax(Number(leadTimeMaxData));
  }

  // Mutations for updating settings
  const { mutateAsync: updateLeadTimeMinAsync, isPending: isUpdatingMin } =
    useMutation(api.admin.settings.update.mutationOptions());
  const { mutateAsync: updateLeadTimeMaxAsync, isPending: isUpdatingMax } =
    useMutation(api.admin.settings.update.mutationOptions());

  const handleSave = async () => {
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

    // Invalidate all queries to refetch updated settings
    void queryClient.invalidateQueries();
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
