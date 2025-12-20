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
 * - Local inventory Google Sheet integration
 * - Manual inventory sync
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

  // Fetch local inventory sheet settings
  const { data: sheetData, refetch: refetchSheetData } = useQuery(
    api.admin.localInventorySheet.get.queryOptions(),
  );

  // Local state for form inputs
  const [leadTimeMin, setLeadTimeMin] = useState<number>(
    leadTimeMinData ? Number(leadTimeMinData) : 14,
  );
  const [leadTimeMax, setLeadTimeMax] = useState<number>(
    leadTimeMaxData ? Number(leadTimeMaxData) : 21,
  );
  const [googleSheetUrl, setGoogleSheetUrl] = useState<string>('');

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

  // Mutations for local inventory
  const { mutateAsync: updateSheetAsync, isPending: isUpdatingSheet } =
    useMutation(api.admin.localInventorySheet.update.mutationOptions());
  const { mutateAsync: syncInventoryAsync, isPending: isSyncing } = useMutation(
    api.products.localInventorySyncManual.mutationOptions(),
  );

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

  const handleUpdateSheet = async () => {
    try {
      await updateSheetAsync({ googleSheetUrl });
      await refetchSheetData();
      setGoogleSheetUrl('');
      toast.success('Google Sheet URL updated successfully');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update Google Sheet URL',
      );
    }
  };

  const handleSyncInventory = async () => {
    try {
      const result = await syncInventoryAsync();
      await refetchSheetData();
      void queryClient.invalidateQueries();
      toast.success(
        `Sync completed! ${result.totalItems} items processed, ${result.offersDeleted} offers removed`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to sync inventory',
      );
    }
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

      {/* Local Inventory Section */}
      <div className="space-y-4">
        <div>
          <Typography variant="bodySm" className="font-semibold">
            Local Inventory Sheet
          </Typography>
          <Typography variant="bodyXs" colorRole="muted">
            Configure Google Sheets integration for local inventory management
          </Typography>
        </div>

        {sheetData?.sheetName && (
          <div className="rounded-md border border-border-muted bg-background-secondary p-3">
            <div className="space-y-1">
              <Typography variant="bodyXs" colorRole="muted">
                Current Sheet
              </Typography>
              <Typography variant="bodySm">{sheetData.sheetName}</Typography>
              {sheetData.lastSync && (
                <Typography variant="bodyXs" colorRole="muted">
                  Last synced:{' '}
                  {new Date(sheetData.lastSync).toLocaleString('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </Typography>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="googleSheetUrl">
            <Typography variant="bodyXs" colorRole="muted">
              Google Sheet URL
            </Typography>
          </label>
          <div className="flex gap-2">
            <Input
              id="googleSheetUrl"
              type="text"
              value={googleSheetUrl}
              onChange={(e) => setGoogleSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="flex-1"
            />
            <Button
              variant="default"
              onClick={handleUpdateSheet}
              isDisabled={isUpdatingSheet || !googleSheetUrl.trim()}
            >
              <ButtonContent>
                {isUpdatingSheet ? 'Updating...' : 'Update Sheet'}
              </ButtonContent>
            </Button>
          </div>
          <Typography variant="bodyXs" colorRole="muted" className="italic">
            Paste the full Google Sheets URL to sync local inventory products
          </Typography>
        </div>

        <div className="flex items-center justify-between rounded-md border border-border-muted bg-background-secondary p-3">
          <div>
            <Typography variant="bodySm" className="font-medium">
              Sync Inventory
            </Typography>
            <Typography variant="bodyXs" colorRole="muted">
              Manually sync products from the Google Sheet
            </Typography>
          </div>
          <Button
            variant="default"
            colorRole="brand"
            onClick={handleSyncInventory}
            isDisabled={isSyncing || !sheetData?.googleSheetId}
          >
            <ButtonContent>{isSyncing ? 'Syncing...' : 'Sync Now'}</ButtonContent>
          </Button>
        </div>
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
