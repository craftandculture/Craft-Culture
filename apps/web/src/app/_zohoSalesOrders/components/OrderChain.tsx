'use client';

import { IconCheck, IconLink } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

export interface OrderChainProps {
  releaseId?: string;
  pcoId?: string;
  salesOrderId?: string;
}

/**
 * The paperwork behind one delivery or client order, in a single strip
 *
 * Release → PCO → Zoho sales order → invoice → pick list → dispatch →
 * delivered, read through the stored links. A missing step shows as a gap;
 * a missing sales order offers "Link to sales order" right there, for one
 * the team raised by hand in Zoho.
 */
const OrderChain = ({ releaseId, pcoId, salesOrderId }: OrderChainProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [soNumber, setSoNumber] = useState('');

  const chainQuery = useQuery(
    api.zohoSalesOrders.getChain.queryOptions({ releaseId, pcoId, salesOrderId }),
  );

  const link = useMutation({
    ...api.zohoSalesOrders.linkToPco.mutationOptions(),
    onSuccess: (result) => {
      toast.success(`${result.salesOrderNumber} linked to ${result.pcoNumber}`);
      setSoNumber('');
      void queryClient.invalidateQueries({
        queryKey: api.zohoSalesOrders.getChain.queryKey(),
      });
    },
    onError: (error) => toast.error(error.message),
  });

  const chain = chainQuery.data;
  if (!chain) {
    return (
      <div className="bg-fill-muted h-12 animate-pulse rounded-lg" aria-hidden />
    );
  }

  const pcoStep = chain.steps.find((step) => step.key === 'pco');
  const soStep = chain.steps.find((step) => step.key === 'salesOrder');
  // The order exists but nothing in Zoho is linked to it yet
  const pcoIdForLink = pcoStep?.done && !soStep?.done ? chain.pcoId : null;

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-wrap items-stretch gap-1.5">
        {chain.steps.map((step, index) => (
          <li key={step.key} className="flex items-center gap-1.5">
            <div
              className={`flex min-w-[7rem] flex-col rounded-lg border px-2.5 py-1.5 ${
                step.done
                  ? 'border-border-primary bg-fill-primary'
                  : step.reference
                    ? 'border-border-primary bg-fill-muted'
                    : 'border-border-muted border-dashed'
              }`}
            >
              <span className="text-text-muted flex items-center gap-1 text-[10px] font-semibold tracking-wide uppercase">
                {step.done && <Icon icon={IconCheck} size="xs" />}
                {step.label}
              </span>
              {step.reference ? (
                step.href ? (
                  <Link
                    href={step.href}
                    className="text-text-primary font-mono text-xs font-semibold underline-offset-2 hover:underline"
                  >
                    {step.reference}
                  </Link>
                ) : (
                  <span className="text-text-primary font-mono text-xs font-semibold">
                    {step.reference}
                  </span>
                )
              ) : (
                <span className="text-text-muted text-xs">
                  {step.done ? 'Done' : '—'}
                </span>
              )}
              {(step.status || step.at) && (
                <span className="text-text-muted text-[11px]">
                  {[
                    step.status?.replace(/_/g, ' '),
                    step.at ? format(new Date(step.at), 'd MMM') : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              )}
            </div>
            {index < chain.steps.length - 1 && (
              <span className="text-text-muted text-xs" aria-hidden>
                →
              </span>
            )}
          </li>
        ))}
      </ol>

      {pcoIdForLink && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!soNumber.trim()) return;
            link.mutate({ pcoId: pcoIdForLink, salesOrderNumber: soNumber });
          }}
        >
          <Typography variant="bodyXs" colorRole="muted">
            Raised the sales order by hand in Zoho?
          </Typography>
          <Input
            value={soNumber}
            onChange={(event) => setSoNumber(event.target.value)}
            placeholder="SO-00000"
            className="w-32"
            size="sm"
          />
          <Button
            type="submit"
            size="sm"
            isDisabled={!soNumber.trim() || link.isPending}
          >
            <Icon icon={IconLink} size="sm" />
            Link to sales order
          </Button>
        </form>
      )}
    </div>
  );
};

export default OrderChain;
