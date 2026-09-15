'use client';

import { IconCheck, IconRefresh, IconX } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import displayWineName from '@/app/_wms/utils/displayWineName';
import useTRPC from '@/lib/trpc/browser';

type StatusFilter = 'open' | 'all' | 'payment_claimed' | 'reserved' | 'completed';

const money = (value: number) =>
  `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const STATE_STYLES: Record<string, string> = {
  reserved: 'bg-amber-100 text-amber-800',
  payment_claimed: 'bg-violet-100 text-violet-800',
  completed: 'bg-teal-100 text-teal-800',
};

const STATE_LABELS: Record<string, string> = {
  reserved: 'Awaiting payment',
  payment_claimed: 'Says they have paid',
  completed: 'Transferred',
  expired: 'Lapsed',
  cancelled: 'Cancelled',
};

/**
 * Confirming that a member's money actually arrived
 *
 * A member marking a transfer as sent is a claim. This screen is where somebody
 * looks at the bank and says it landed, and that confirmation is the only thing
 * that moves wine — the same rule that governs paying consignors, applied to
 * the other side of the trade.
 *
 * Confirming is irreversible in practice: ownership moves, and where the parcel
 * belonged to a member a settlement is written that they are then owed.
 */
const CellarPurchasesPage = () => {
  const api = useTRPC();
  const [status, setStatus] = useState<StatusFilter>('open');
  const [openId, setOpenId] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    ...api.consignment.admin.getPurchases.queryOptions({ status }),
  });

  const { mutate: cancelPurchase, isPending: isCancelling } = useMutation(
    api.consignment.admin.cancelPurchase.mutationOptions({
      onSuccess: (result) => {
        toast.success(`${result.purchaseNumber} cancelled — the wine is back on the list.`);
        setConfirmCancelId(null);
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const { mutate: confirm, isPending } = useMutation(
    api.consignment.admin.confirmPurchasePayment.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          `${result.purchaseNumber} transferred to ${result.buyerName}.`,
        );
        setOpenId(null);
        setReference('');
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const purchases = data?.purchases ?? [];

  const filters: { id: StatusFilter; label: string }[] = [
    { id: 'open', label: 'Open' },
    { id: 'payment_claimed', label: 'Says they have paid' },
    { id: 'reserved', label: 'Awaiting payment' },
    { id: 'completed', label: 'Transferred' },
    { id: 'all', label: 'All' },
  ];

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Typography variant="headingLg">Cellar purchases</Typography>
          <Typography variant="bodySm" colorRole="muted" className="mt-1 block">
            Members buying wine in bond. Nothing moves until you confirm the
            money landed.
          </Typography>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          isDisabled={isRefetching}
        >
          <ButtonContent iconLeft={IconRefresh}>Refresh</ButtonContent>
        </Button>
      </div>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setStatus(filter.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              status === filter.id
                ? 'bg-fill-brand text-text-on-brand'
                : 'border-border-muted text-text-muted hover:text-text-primary border'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <Typography variant="bodySm" colorRole="muted">
          Loading&hellip;
        </Typography>
      )}

      {!isLoading && purchases.length === 0 && (
        <div className="border-border-muted rounded-xl border px-6 py-12 text-center">
          <Typography variant="bodyMd" colorRole="muted">
            Nothing waiting.
          </Typography>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {purchases.map((purchase) => {
          const isOpen = openId === purchase.id;
          const claimed = purchase.status === 'payment_claimed';
          const actionable = ['reserved', 'payment_claimed'].includes(
            purchase.status,
          );

          return (
            <div
              key={purchase.id}
              className="border-border-muted overflow-hidden rounded-xl border"
            >
              <button
                type="button"
                onClick={() => {
                  setOpenId(isOpen ? null : purchase.id);
                  setReference(purchase.paymentReference ?? '');
                }}
                className="hover:bg-fill-muted/40 flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <Typography variant="bodySm" className="font-semibold">
                    {purchase.buyerName}
                    <span className="text-text-muted ml-2 font-mono text-xs">
                      {purchase.purchaseNumber}
                    </span>
                  </Typography>
                  <Typography
                    variant="bodyXs"
                    colorRole="muted"
                    className="mt-0.5 block"
                  >
                    {purchase.items.length}{' '}
                    {purchase.items.length === 1 ? 'wine' : 'wines'}
                    {purchase.settlesToMembers && ' · settles to a member'}
                    {purchase.paymentClaimedAt
                      ? ` · claimed ${formatDistanceToNowStrict(new Date(purchase.paymentClaimedAt), { addSuffix: true })}`
                      : purchase.reservedUntil
                        ? ` · held ${formatDistanceToNowStrict(new Date(purchase.reservedUntil), { addSuffix: true })}`
                        : ''}
                  </Typography>
                </div>
                <div className="flex flex-shrink-0 items-center gap-3">
                  <Typography
                    variant="bodySm"
                    className="font-semibold tabular-nums"
                  >
                    {money(purchase.totalUsd)}
                  </Typography>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      STATE_STYLES[purchase.status] ??
                      'bg-fill-secondary text-text-muted'
                    }`}
                  >
                    {STATE_LABELS[purchase.status] ?? purchase.status}
                  </span>
                </div>
              </button>

              {isOpen && (
                <div className="border-border-muted bg-fill-muted/30 border-t px-4 py-4">
                  <div className="border-border-muted bg-background-primary mb-4 inline-block max-w-full overflow-x-auto rounded-lg border align-top">
                    <table className="text-sm">
                      <thead>
                        <tr className="text-text-muted border-border-muted border-b text-[10px] uppercase tracking-wider">
                          <th className="px-3 py-1.5 text-left">Wine</th>
                          <th className="px-3 py-1.5 text-right">Cases</th>
                          <th className="px-3 py-1.5 text-right">Line</th>
                          <th className="px-3 py-1.5 text-left">Settles to</th>
                        </tr>
                      </thead>
                      <tbody className="divide-border-muted/60 divide-y">
                        {purchase.items.map((item) => (
                          <tr key={item.id}>
                            <td className="px-3 py-2">
                              {displayWineName(item.productName)}
                              {item.vintage ? ` · ${item.vintage}` : ''}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {item.cases}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {money(item.lineTotalUsd)}
                            </td>
                            <td className="text-text-muted px-3 py-2 text-xs">
                              {item.mandateId ? 'A member' : 'C&C'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {actionable ? (
                    <>
                      {/*
                        Said before the button, not after. Confirming moves
                        ownership and, where a parcel was a member's, writes a
                        settlement they are then owed — neither of which has an
                        undo.
                      */}
                      <Typography
                        variant="bodyXs"
                        colorRole="muted"
                        className="mb-3 block max-w-[68ch]"
                      >
                        Confirm only once the money is visible in the bank.
                        Ownership moves immediately
                        {purchase.settlesToMembers
                          ? ', and the members whose parcels these were become owed for them on the next payout run.'
                          : '.'}{' '}
                        There is no undo.
                      </Typography>

                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          value={reference}
                          onChange={(event) => setReference(event.target.value)}
                          placeholder="Bank reference"
                          className="max-w-[240px]"
                        />
                        <Button
                          size="sm"
                          colorRole="brand"
                          isDisabled={isPending}
                          onClick={() =>
                            confirm({
                              purchaseId: purchase.id,
                              paymentReference: reference || undefined,
                            })
                          }
                        >
                          <ButtonContent iconLeft={IconCheck}>
                            Confirm payment &amp; transfer
                          </ButtonContent>
                        </Button>
                        {!claimed && (
                          <Typography variant="bodyXs" colorRole="muted">
                            They have not said they have paid yet.
                          </Typography>
                        )}

                        {/*
                          Cancelling releases the holds so the wine goes back on
                          the list. Pushed right and quiet: it is the answer for
                          money that never arrived, not a routine action.
                        */}
                        {confirmCancelId === purchase.id ? (
                          <span className="ml-auto inline-flex items-center gap-2">
                            <Typography variant="bodyXs" colorRole="muted">
                              Release the wine?
                            </Typography>
                            <Button
                              size="sm"
                              variant="outline"
                              colorRole="danger"
                              isDisabled={isCancelling}
                              onClick={() =>
                                cancelPurchase({ purchaseId: purchase.id })
                              }
                            >
                              <ButtonContent>Yes, cancel</ButtonContent>
                            </Button>
                            <button
                              type="button"
                              onClick={() => setConfirmCancelId(null)}
                              className="text-text-muted hover:text-text-primary px-1 text-xs font-medium"
                            >
                              Keep it
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmCancelId(purchase.id)}
                            className="text-text-muted ml-auto inline-flex items-center gap-1 rounded px-2 py-1.5 text-xs font-medium transition-colors hover:text-red-700"
                          >
                            <Icon icon={IconX} size="xs" />
                            Cancel
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <Typography variant="bodyXs" colorRole="muted">
                      {purchase.status === 'completed'
                        ? `Transferred${purchase.paymentConfirmedAt ? ` ${formatDistanceToNowStrict(new Date(purchase.paymentConfirmedAt), { addSuffix: true })}` : ''}.`
                        : `This purchase is ${STATE_LABELS[purchase.status] ?? purchase.status}.`}
                    </Typography>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CellarPurchasesPage;
