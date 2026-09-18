'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import fileToBase64 from '@/app/_triangulation/utils/fileToBase64';
import Button from '@/app/_ui/components/Button/Button';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

export interface SalesUploadProps {
  outletId: string | null;
  onImported: () => Promise<void> | void;
}

interface Outcome {
  monthLabel: string;
  lines: number;
  bottles: number;
  declaredBottles: number | null;
  agrees: boolean;
  listedUnsold: number;
  unattributedBottles: number;
  unattributed: string[];
}

/**
 * Take the outlet's monthly sales report
 *
 * The one thing still uploaded. Once there are two snapshot boundaries the
 * month can be derived by differencing them and this becomes a confirmation
 * rather than the source — but the feed carries no history, so until then the
 * sheet is the only way to know what sold before we started watching.
 *
 * The outcome stays on the page rather than in a toast. A toast saying "12
 * bottles could not be attributed" and then vanishing is the same as not
 * having said it, and those bottles are excluded from every statement until
 * someone acts on them.
 */
const SalesUpload = ({ outletId, onImported }: SalesUploadProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [year, setYear] = useState(new Date().getFullYear());
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const upload = useMutation({
    ...api.distribution.admin.importOutletSales.mutationOptions(),
    onSuccess: async (result) => {
      setOutcome(result);
      toast.success(
        `${result.monthLabel}: ${result.lines} wines, ${result.bottles} bottles`,
      );
      await queryClient.invalidateQueries({
        queryKey: api.distribution.admin.getBalances.queryKey(),
      });
      await onImported();
    },
    onError: (error) => {
      setOutcome(null);
      toast.error(error.message);
    },
  });

  const handleFile = async (file: File | undefined) => {
    if (!file || !outletId) return;

    upload.mutate({
      outletId,
      year,
      file: await fileToBase64(file),
      fileName: file.name,
    });
  };

  return (
    <div className="border-border-primary space-y-3 rounded-xl border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Typography variant="labelSm">Monthly sales report</Typography>
          <Typography variant="bodyXs" colorRole="muted" asChild>
            <p className="mt-1 max-w-sm">
              Their own sheet. The month comes from the column heading; the year
              is set here, because the sheet never states one.
            </p>
          </Typography>
        </div>
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-text-muted text-xs">Year</span>
            <input
              type="number"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              className="border-border-primary bg-fill-primary text-text-primary min-h-9 w-24 rounded-md border px-2 text-sm"
            />
          </label>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          <Button
            colorRole="brand"
            size="sm"
            isDisabled={upload.isPending || !outletId}
            onClick={() => fileRef.current?.click()}
          >
            {upload.isPending ? 'Reading…' : 'Upload sales'}
          </Button>
        </div>
      </div>

      {outcome ? (
        <div className="border-border-primary space-y-2 border-t pt-3">
          <Typography variant="bodySm" asChild>
            <p>
              <strong>{outcome.monthLabel}</strong> — {outcome.lines} wines,{' '}
              {outcome.bottles} bottles taken.{' '}
              {outcome.listedUnsold > 0
                ? `${outcome.listedUnsold} listed but sold nothing.`
                : ''}
            </p>
          </Typography>

          {/*
            Their total against ours. Quietly reconciling to theirs would hide a
            line we failed to read, so disagreement is stated and settling is
            discouraged until it is explained.
          */}
          {outcome.declaredBottles !== null ? (
            <Typography
              variant="bodyXs"
              colorRole={outcome.agrees ? 'success' : 'danger'}
              asChild
            >
              <p>
                {outcome.agrees
                  ? `Agrees with their stated total of ${outcome.declaredBottles}.`
                  : `They state ${outcome.declaredBottles} bottles; we read ${outcome.bottles}. Something was not read — do not settle from this until it is explained.`}
              </p>
            </Typography>
          ) : null}

          {outcome.unattributedBottles > 0 ? (
            <div>
              <Typography variant="bodyXs" colorRole="warning" asChild>
                <p>
                  {outcome.unattributedBottles} bottles sold that cannot be tied
                  to an owner — excluded from every statement until they can be:
                </p>
              </Typography>
              <ul className="text-text-muted mt-1 max-h-40 overflow-y-auto text-xs">
                {outcome.unattributed.map((line) => (
                  <li key={line} className="py-0.5">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default SalesUpload;
