'use client';

import { IconAlertTriangle, IconPrinter } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import usePrint from '../hooks/usePrint';

export interface RemainderToRelabel {
  stockId: string;
  lwin18: string;
  productName: string;
  /** Bottles now on the shelf under this code */
  bottles: number;
  locationCode: string | null;
}

export interface RelabelRemainderPromptProps {
  remainder: RemainderToRelabel;
  onDone: () => void;
}

/**
 * Make the picker relabel the case they are about to put back
 *
 * Cracking a case splits one stock row into two: the bottles picked, and the
 * remainder, which the system records under a new code — a 3-pack that gave up
 * two bottles leaves `…-01-…`. The bottles themselves do not move. They go back
 * on the shelf inside the box they came out of, still wearing a label that says
 * 3x75cl.
 *
 * Nothing in the WMS was wrong; the shelf was. And the shelf is what the next
 * person reads — they scan a case marked as three, the system says one, and the
 * pick either stops or takes the wrong thing.
 *
 * So this stands in the way at the only moment the box is in someone's hands
 * and the discrepancy is a fact rather than a mystery. It can be dismissed —
 * a printer is not always reachable and picking must not stop — but it has to
 * be dismissed deliberately.
 */
const RelabelRemainderPrompt = ({
  remainder,
  onDone,
}: RelabelRemainderPromptProps) => {
  const api = useTRPC();
  const { print } = usePrint();

  const { mutate: makeLabel, isPending } = useMutation({
    ...api.wms.admin.labels.printStockLabel.mutationOptions(),
    onSuccess: async (result) => {
      if (!result.success || !result.zpl) {
        toast.error('Could not build the label for this stock');

        return;
      }

      const printed = await print(result.zpl, '4x2');

      if (printed) {
        toast.success('Label printed — stick it on before the case goes back');
        onDone();

        return;
      }

      toast.error('Failed to reach printer — check WiFi connection');
    },
    onError: (error) => {
      toast.error(error.message || 'Could not print the label');
    },
  });

  return (
    <div className="flex flex-col gap-3 rounded-xl border-2 border-fill-warning bg-fill-warning/10 p-4">
      <div className="flex items-start gap-2">
        <Icon
          icon={IconAlertTriangle}
          size="md"
          className="mt-0.5 shrink-0 text-fill-warning"
        />
        <div>
          <Typography variant="headingSm">Relabel the case</Typography>
          <Typography variant="bodySm" className="text-text-muted">
            The box going back is no longer the pack printed on it.
          </Typography>
        </div>
      </div>

      <div className="flex flex-col gap-1 rounded-lg bg-background-primary/70 p-3">
        <Typography variant="bodyMd" className="font-medium">
          {remainder.productName}
        </Typography>
        <code className="font-mono text-sm text-text-muted">
          {remainder.lwin18}
        </code>
        <Typography variant="bodySm" className="text-text-muted">
          {remainder.bottles} bottle{remainder.bottles === 1 ? '' : 's'} now at{' '}
          {remainder.locationCode ?? 'this bay'}
        </Typography>
      </div>

      {/*
        Full width and tall: this is pressed on a TC27 with one hand, often
        while holding the case the label is going on.
      */}
      <Button
        className="h-14 w-full"
        onClick={() => makeLabel({ stockId: remainder.stockId })}
        disabled={isPending}
      >
        <Icon icon={IconPrinter} size="md" />
        {isPending ? 'Printing...' : 'Print new label'}
      </Button>

      <Button variant="ghost" className="h-11 w-full" onClick={onDone}>
        Already relabelled — carry on
      </Button>
    </div>
  );
};

export default RelabelRemainderPrompt;
