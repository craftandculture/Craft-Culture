'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import fileToBase64 from '@/app/_triangulation/utils/fileToBase64';
import Button from '@/app/_ui/components/Button/Button';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

export interface CodesRegisterUploadProps {
  outletId: string | null;
  month: string;
}

interface Outcome {
  rows: number;
  withCode: number;
  withOwner: number;
  invoices: number;
  unknownOwners: string[];
}

/**
 * Upload the Codes tab of the "CD x C&C Payment Run" sheet
 *
 * The register of City Drinks' codes against wine, owner and invoice. It is
 * what still knows a wine after City Drinks have sold out of it and dropped it
 * from their feed, so after each upload the month is matched again.
 *
 * @example
 *   <CodesRegisterUpload outletId={outletId} month="2026-10" />
 */
const CodesRegisterUpload = ({ outletId, month }: CodesRegisterUploadProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const refresh = async () => {
    await Promise.all(
      [
        api.distribution.admin.getUnmatchedLines.queryKey(),
        api.distribution.admin.getMonthSummary.queryKey(),
        api.distribution.admin.getStatement.queryKey(),
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
  };

  const rematch = useMutation({
    ...api.distribution.admin.reattributeMonth.mutationOptions(),
    onSuccess: async (result) => {
      toast.success(
        `${month} matched again: ${result.unattributedBottles} bottles still waiting.`,
      );
      await refresh();
    },
    /* No sales on file for the month is not an upload failure */
    onError: async () => {
      await refresh();
    },
  });

  const upload = useMutation({
    ...api.distribution.admin.importOutletCodes.mutationOptions(),
    onSuccess: (result) => {
      setOutcome(result);
      toast.success(`Codes tab read: ${result.rows} rows`);

      if (outletId) rematch.mutate({ outletId, month });
    },
    onError: (error) => {
      setOutcome(null);
      toast.error(error.message);
    },
  });

  const handleFile = async (file: File | undefined) => {
    if (!file || !outletId) return;

    upload.mutate({ outletId, file: await fileToBase64(file) });
  };

  return (
    <div className="border-border-primary space-y-3 rounded-xl border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Typography variant="labelSm">Codes tab</Typography>
          <Typography variant="bodyXs" colorRole="muted" asChild>
            <p className="mt-1 max-w-sm">
              From the &ldquo;CD x C&amp;C Payment Run&rdquo; sheet: each City
              Drinks code against its wine, owner and invoice. Download the tab
              as .xlsx or .csv and upload it here.
            </p>
          </Typography>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(event) => {
            void handleFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        <Button
          size="sm"
          variant="outline"
          isDisabled={upload.isPending || rematch.isPending || !outletId}
          onClick={() => fileRef.current?.click()}
        >
          {upload.isPending
            ? 'Reading…'
            : rematch.isPending
              ? 'Matching…'
              : 'Upload Codes tab'}
        </Button>
      </div>

      {outcome ? (
        <div className="border-border-primary space-y-1 border-t pt-3">
          <Typography variant="bodyXs" asChild>
            <p>
              {outcome.rows} rows over {outcome.invoices} invoices ·{' '}
              {outcome.withCode} with a City Drinks code · {outcome.withOwner}{' '}
              with an owner we know.
            </p>
          </Typography>
          {outcome.unknownOwners.length > 0 ? (
            <Typography variant="bodyXs" colorRole="danger" asChild>
              <p>
                Owner not recognised: {outcome.unknownOwners.join(', ')}. Those
                rows will not attribute anything until the label matches an
                owner.
              </p>
            </Typography>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default CodesRegisterUpload;
