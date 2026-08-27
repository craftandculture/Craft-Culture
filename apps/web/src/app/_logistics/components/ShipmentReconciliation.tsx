'use client';

import { IconCheck, IconLoader2, IconScale } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import DeclaredComparison from './DeclaredComparison';

export interface ShipmentReconciliationProps {
  shipmentId: string;
  /** What the paperwork declared, as read at import */
  declared: {
    cases: number | null;
    bottles: number | null;
    cartons: number | null;
    pallets: number | null;
    value: number | null;
    currency: string | null;
    source: string | null;
    confirmedAt: Date | string | null;
  };
  /** What the shipment actually holds */
  ours: {
    cases: number;
    looseBottles: number;
    value: number;
    currency: string | null;
  };
}

/**
 * The checkpoint between a document and the shipment built from it
 *
 * A supplier states, on the invoice, how many cases and bottles and how much
 * money is in the consignment, and writes on the foot of it how many cartons
 * went on how many pallets. Those are the numbers a warehouse counts against
 * on arrival and a broker declares to customs, and until now they were read
 * and thrown away — so a shipment could hold six cartons of the twelve that
 * were shipped and nothing anywhere disagreed.
 *
 * Confirming is a person's act, not a calculation: it records that someone set
 * the two columns side by side and accepted them. A mismatch does not block
 * it, because cases and cartons legitimately differ when loose bottles are
 * consolidated into a mixed box — a check that refused those would be turned
 * off within the week.
 *
 * @param props - The shipment, what its paperwork declared, and what it holds
 * @returns The comparison and its confirm control
 */
const ShipmentReconciliation = ({
  shipmentId,
  declared,
  ours,
}: ShipmentReconciliationProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  /** Cartons cannot be counted from the lines, so they are typed in */
  const [cartons, setCartons] = useState<string>(
    declared.cartons != null ? String(declared.cartons) : '',
  );
  const [pallets, setPallets] = useState<string>(
    declared.pallets != null ? String(declared.pallets) : '',
  );

  const { mutate: confirm, isPending } = useMutation(
    api.logistics.admin.confirmDeclaredTotals.mutationOptions({
      onSuccess: () => {
        toast.success('Shipment reconciled against its paperwork');
        void queryClient.invalidateQueries({
          queryKey: [['logistics', 'admin', 'getOne']],
        });
      },
      onError: (error) => {
        toast.error(error.message || 'Could not record the confirmation');
      },
    }),
  );

  const nothingDeclared =
    declared.cases == null &&
    declared.bottles == null &&
    declared.cartons == null &&
    declared.value == null;

  if (nothingDeclared) return null;

  const confirmedAt = declared.confirmedAt
    ? new Date(declared.confirmedAt)
    : null;

  return (
    <div className="border-border-primary bg-fill-primary flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <Icon icon={IconScale} size="md" colorRole="muted" />
        <Typography variant="headingSm">Against the paperwork</Typography>
      </div>

      <DeclaredComparison
        source={declared.source}
        rows={[
          {
            label: 'Cases billed',
            declared: declared.cases,
            ours: ours.cases,
          },
          {
            label: 'Loose bottles billed',
            declared: declared.bottles,
            ours: ours.looseBottles,
            note: 'Bottles sold out of a pack — they travel in a mixed carton',
          },
          {
            label: `Goods value${declared.currency ? ` (${declared.currency})` : ''}`,
            declared: declared.value,
            ours:
              declared.currency && ours.currency === declared.currency
                ? ours.value
                : null,
            tolerance: 0.005,
            note:
              declared.currency && ours.currency !== declared.currency
                ? `The lines are held in ${ours.currency ?? 'no stated currency'}, so the two are not comparable`
                : undefined,
            format: (value) =>
              value.toLocaleString('en-GB', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }),
          },
        ]}
      />

      {/*
        Cartons are the one figure the lines can never yield — several
        bottle-billed lines go into one mixed box and only the packer knows how
        many — so they are stated here and checked against on arrival.
      */}
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <Typography variant="bodyXs" colorRole="muted">
            Cartons shipped
          </Typography>
          <input
            type="number"
            min="0"
            value={cartons}
            onChange={(event) => setCartons(event.target.value)}
            className="border-border-primary bg-fill-primary text-text-primary h-8 w-24 rounded-md border px-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <Typography variant="bodyXs" colorRole="muted">
            Pallets
          </Typography>
          <input
            type="number"
            min="0"
            value={pallets}
            onChange={(event) => setPallets(event.target.value)}
            className="border-border-primary bg-fill-primary text-text-primary h-8 w-24 rounded-md border px-2 text-sm"
          />
        </label>

        <div className="flex flex-1 items-center justify-end gap-3">
          {confirmedAt ? (
            <Typography variant="bodyXs" colorRole="muted">
              Confirmed {confirmedAt.toLocaleDateString('en-GB')}
            </Typography>
          ) : null}
          <Button
            size="sm"
            variant={confirmedAt ? 'ghost' : 'default'}
            isDisabled={isPending}
            onClick={() =>
              confirm({
                shipmentId,
                declaredCartons: cartons === '' ? null : Number(cartons),
                declaredPallets: pallets === '' ? null : Number(pallets),
              })
            }
          >
            <ButtonContent iconLeft={isPending ? IconLoader2 : IconCheck}>
              {isPending
                ? 'Saving...'
                : confirmedAt
                  ? 'Confirm again'
                  : 'Confirm against document'}
            </ButtonContent>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ShipmentReconciliation;
