'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import fileToBase64 from '@/app/_triangulation/utils/fileToBase64';
import Button from '@/app/_ui/components/Button/Button';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

export interface OwnerCostsUploadProps {
  outletId: string | null;
  owners: { id: string; name: string }[];
}

interface Outcome {
  ownerName: string;
  tabsRead: string[];
  rows: number;
  matched: number;
  unmatched: string[];
}

/**
 * Upload a partner's own price sheet: what they are owed per bottle
 *
 * Crurated are paid from their recon workbook (Ocean freight first, the
 * airfreight tabs for wines that never came by sea), Cru from the "Cru Sales
 * UAE" list. Each owner is chosen explicitly so a sheet can never be filed
 * against the wrong partner.
 *
 * @example
 *   <OwnerCostsUpload outletId={outletId} owners={owners} />
 */
const OwnerCostsUpload = ({ outletId, owners }: OwnerCostsUploadProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const priced = owners.filter((owner) => /crurated|^cru\b/i.test(owner.name));
  const [ownerId, setOwnerId] = useState('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const upload = useMutation({
    ...api.distribution.admin.importOwnerCosts.mutationOptions(),
    onSuccess: async (result) => {
      const ownerName = owners.find((owner) => owner.id === ownerId)?.name ?? '';

      setOutcome({ ...result, ownerName });
      toast.success(`${ownerName}: ${result.matched} wines priced`);
      await Promise.all(
        [
          api.distribution.admin.getStatement.queryKey(),
          api.distribution.admin.getMonthSummary.queryKey(),
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
    },
    onError: (error) => {
      setOutcome(null);
      toast.error(error.message);
    },
  });

  const handleFile = async (file: File | undefined) => {
    if (!file || !outletId || !ownerId) return;

    upload.mutate({ outletId, ownerId, file: await fileToBase64(file) });
  };

  return (
    <div className="border-border-primary space-y-3 rounded-xl border p-4">
      <div>
        <Typography variant="labelSm">Partner price sheet</Typography>
        <Typography variant="bodyXs" colorRole="muted" asChild>
          <p className="mt-1 max-w-sm">
            What the partner is owed per bottle. Crurated: the Payment Run and
            Recon workbook. Cru Wine: the Cru Sales UAE list. Other partners
            are paid at the Pricing Manager&rsquo;s landed cost.
          </p>
        </Typography>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <select
          value={ownerId}
          onChange={(event) => setOwnerId(event.target.value)}
          className="border-border-primary bg-fill-primary text-text-primary min-h-9 rounded-md border px-2 text-sm"
        >
          <option value="">Choose the partner…</option>
          {priced.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.name}
            </option>
          ))}
        </select>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(event) => {
            void handleFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        <Button
          size="sm"
          variant="outline"
          isDisabled={upload.isPending || !outletId || !ownerId}
          onClick={() => fileRef.current?.click()}
        >
          {upload.isPending ? 'Reading…' : 'Upload price sheet'}
        </Button>
      </div>

      {outcome ? (
        <div className="border-border-primary space-y-1 border-t pt-3">
          <Typography variant="bodyXs" asChild>
            <p>
              {outcome.ownerName}: {outcome.rows} prices read from{' '}
              {outcome.tabsRead.join(', ')}; {outcome.matched} tied to wines we
              invoiced for them.
            </p>
          </Typography>
          {outcome.unmatched.length > 0 ? (
            <Typography variant="bodyXs" colorRole="muted" asChild>
              <p>
                {outcome.rows - outcome.matched} rows priced wines never
                invoiced to this outlet, which is expected for a full price
                list. Any of those that City Drinks do sell will show on the
                statement as having no cost.
              </p>
            </Typography>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default OwnerCostsUpload;
