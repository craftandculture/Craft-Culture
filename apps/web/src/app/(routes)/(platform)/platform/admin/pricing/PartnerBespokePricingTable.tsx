'use client';

import { IconLoader2, IconPlus, IconTrash, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Select from '@/app/_ui/components/Select/Select';
import SelectContent from '@/app/_ui/components/Select/SelectContent';
import SelectItem from '@/app/_ui/components/Select/SelectItem';
import SelectTrigger from '@/app/_ui/components/Select/SelectTrigger';
import SelectValue from '@/app/_ui/components/Select/SelectValue';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC, { useTRPCClient } from '@/lib/trpc/browser';

interface NewOverrideForm {
  partnerId: string;
  ccMarginPercent: string;
  importDutyPercent: string;
  transferCostPercent: string;
  distributorMarginPercent: string;
  vatPercent: string;
  notes: string;
}

const EMPTY_FORM: NewOverrideForm = {
  partnerId: '',
  ccMarginPercent: '',
  importDutyPercent: '',
  transferCostPercent: '',
  distributorMarginPercent: '',
  vatPercent: '',
  notes: '',
};

/**
 * Table for managing partner bespoke PCO pricing overrides
 *
 * Displays existing partner overrides and allows adding/editing/removing.
 */
const PartnerBespokePricingTable = () => {
  const api = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();

  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newForm, setNewForm] = useState<NewOverrideForm>(EMPTY_FORM);

  // Fetch existing partner overrides
  const { data: overrides, isLoading: loadingOverrides } = useQuery(
    api.pricing.listPartnerOverrides.queryOptions(),
  );

  // Fetch all partners for dropdown
  const { data: partners, isLoading: loadingPartners } = useQuery(
    api.partners.getMany.queryOptions({}),
  );

  // Create/update mutation
  const { mutateAsync: upsertOverride, isPending: isUpserting } = useMutation({
    mutationFn: async (params: {
      partnerId: string;
      ccMarginPercent?: number | null;
      importDutyPercent?: number | null;
      transferCostPercent?: number | null;
      distributorMarginPercent?: number | null;
      vatPercent?: number | null;
      notes?: string | null;
    }) => {
      return trpcClient.pricing.upsertPartnerOverride.mutate(params);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pricing'] });
    },
  });

  // Delete mutation
  const { mutateAsync: deleteOverride, isPending: isDeleting } = useMutation({
    mutationFn: async (partnerId: string) => {
      return trpcClient.pricing.deletePartnerOverride.mutate({ partnerId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pricing'] });
    },
  });

  // Get partners that don't already have overrides
  const availablePartners =
    partners?.filter((p) => !overrides?.some((o) => o.partnerId === p.id)) ?? [];

  const handleAddNew = async () => {
    if (!newForm.partnerId) {
      toast.error('Please select a partner');
      return;
    }

    try {
      await upsertOverride({
        partnerId: newForm.partnerId,
        ccMarginPercent: newForm.ccMarginPercent ? parseFloat(newForm.ccMarginPercent) : null,
        importDutyPercent: newForm.importDutyPercent ? parseFloat(newForm.importDutyPercent) : null,
        transferCostPercent: newForm.transferCostPercent
          ? parseFloat(newForm.transferCostPercent)
          : null,
        distributorMarginPercent: newForm.distributorMarginPercent
          ? parseFloat(newForm.distributorMarginPercent)
          : null,
        vatPercent: newForm.vatPercent ? parseFloat(newForm.vatPercent) : null,
        notes: newForm.notes || null,
      });
      toast.success('Partner bespoke pricing added');
      setNewForm(EMPTY_FORM);
      setIsAddingNew(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add bespoke pricing');
    }
  };

  const handleDelete = async (partnerId: string, partnerName: string) => {
    if (!confirm(`Remove bespoke pricing for ${partnerName}? They will revert to global defaults.`)) {
      return;
    }

    try {
      await deleteOverride(partnerId);
      toast.success('Bespoke pricing removed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove bespoke pricing');
    }
  };

  const formatValue = (value: number | null, suffix: string) => {
    if (value === null) return <span className="text-text-muted">—</span>;
    return `${value}${suffix}`;
  };

  if (loadingOverrides || loadingPartners) {
    return <div className="h-32 animate-pulse rounded-lg bg-surface-muted" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Typography variant="bodySm" className="font-semibold">
          Partner Bespoke Pricing
        </Typography>
        {!isAddingNew && (
          <Button variant="outline" size="sm" onClick={() => setIsAddingNew(true)}>
            <ButtonContent>
              <Icon icon={IconPlus} size="sm" />
              <span className="ml-1">Add Partner</span>
            </ButtonContent>
          </Button>
        )}
      </div>

      <Typography variant="bodyXs" colorRole="muted">
        Partners with custom pricing will use these values instead of global defaults. Leave fields
        empty to use the global default for that variable.
      </Typography>

      {/* Add New Form */}
      {isAddingNew && (
        <div className="space-y-4 rounded-lg border border-border-muted bg-surface-secondary/50 p-4">
          <div className="flex items-center justify-between">
            <Typography variant="bodySm" className="font-medium">
              Add Bespoke Pricing
            </Typography>
            <Button variant="ghost" size="sm" onClick={() => setIsAddingNew(false)}>
              <Icon icon={IconX} size="sm" />
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="partner-select">
                <Typography variant="bodyXs" className="mb-1 font-medium">
                  Partner
                </Typography>
              </label>
              <Select value={newForm.partnerId} onValueChange={(v) => setNewForm({ ...newForm, partnerId: v })}>
                <SelectTrigger id="partner-select" className="w-full">
                  <SelectValue placeholder="Select a partner..." />
                </SelectTrigger>
                <SelectContent>
                  {availablePartners.length === 0 ? (
                    <div className="p-2 text-center text-sm text-text-muted">
                      All partners already have custom pricing
                    </div>
                  ) : (
                    availablePartners.map((partner) => (
                      <SelectItem key={partner.id} value={partner.id}>
                        {partner.businessName}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label htmlFor="new-cc-margin">
                <Typography variant="bodyXs" className="mb-1 font-medium">
                  C&C Margin %
                </Typography>
              </label>
              <Input
                id="new-cc-margin"
                type="number"
                step="0.1"
                placeholder="2.5"
                value={newForm.ccMarginPercent}
                onChange={(e) => setNewForm({ ...newForm, ccMarginPercent: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="new-import-duty">
                <Typography variant="bodyXs" className="mb-1 font-medium">
                  Import Duty %
                </Typography>
              </label>
              <Input
                id="new-import-duty"
                type="number"
                step="0.1"
                placeholder="20"
                value={newForm.importDutyPercent}
                onChange={(e) => setNewForm({ ...newForm, importDutyPercent: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="new-transfer-cost">
                <Typography variant="bodyXs" className="mb-1 font-medium">
                  Transfer Cost %
                </Typography>
              </label>
              <Input
                id="new-transfer-cost"
                type="number"
                step="0.01"
                placeholder="0.75"
                value={newForm.transferCostPercent}
                onChange={(e) => setNewForm({ ...newForm, transferCostPercent: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="new-distributor-margin">
                <Typography variant="bodyXs" className="mb-1 font-medium">
                  Distributor Margin %
                </Typography>
              </label>
              <Input
                id="new-distributor-margin"
                type="number"
                step="0.1"
                placeholder="7.5"
                value={newForm.distributorMarginPercent}
                onChange={(e) => setNewForm({ ...newForm, distributorMarginPercent: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="new-vat">
                <Typography variant="bodyXs" className="mb-1 font-medium">
                  VAT %
                </Typography>
              </label>
              <Input
                id="new-vat"
                type="number"
                step="0.1"
                placeholder="5"
                value={newForm.vatPercent}
                onChange={(e) => setNewForm({ ...newForm, vatPercent: e.target.value })}
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="new-notes">
                <Typography variant="bodyXs" className="mb-1 font-medium">
                  Notes (optional)
                </Typography>
              </label>
              <Input
                id="new-notes"
                type="text"
                placeholder="Reason for custom pricing..."
                value={newForm.notes}
                onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsAddingNew(false)}>
              Cancel
            </Button>
            <Button
              variant="default"
              colorRole="brand"
              size="sm"
              onClick={handleAddNew}
              isDisabled={isUpserting || !newForm.partnerId}
            >
              <ButtonContent>
                {isUpserting ? (
                  <>
                    <Icon icon={IconLoader2} size="sm" className="animate-spin" />
                    <span className="ml-1">Adding...</span>
                  </>
                ) : (
                  'Add Bespoke Pricing'
                )}
              </ButtonContent>
            </Button>
          </div>
        </div>
      )}

      {/* Existing Overrides Table */}
      {overrides && overrides.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border-muted">
          <table className="w-full text-sm">
            <thead className="bg-surface-secondary/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Partner</th>
                <th className="px-3 py-2 text-right font-medium">C&C %</th>
                <th className="px-3 py-2 text-right font-medium">Duty %</th>
                <th className="px-3 py-2 text-right font-medium">Transfer %</th>
                <th className="px-3 py-2 text-right font-medium">Dist %</th>
                <th className="px-3 py-2 text-right font-medium">VAT %</th>
                <th className="px-3 py-2 text-right font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-muted">
              {overrides.map((override) => (
                <tr key={override.id} className="hover:bg-surface-secondary/30">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span>{override.partnerName}</span>
                      <Badge colorRole="muted" size="sm">
                        {override.partnerType}
                      </Badge>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatValue(override.ccMarginPercent, '%')}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatValue(override.importDutyPercent, '%')}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatValue(override.transferCostPercent, '%')}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatValue(override.distributorMarginPercent, '%')}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatValue(override.vatPercent, '%')}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(override.partnerId, override.partnerName)}
                      isDisabled={isDeleting}
                    >
                      <Icon icon={IconTrash} size="sm" className="text-text-muted hover:text-status-error" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border-muted bg-surface-secondary/30 p-6 text-center">
          <Typography variant="bodySm" colorRole="muted">
            No partners have custom pricing configured. All partners use global PCO defaults.
          </Typography>
        </div>
      )}
    </div>
  );
};

export default PartnerBespokePricingTable;
