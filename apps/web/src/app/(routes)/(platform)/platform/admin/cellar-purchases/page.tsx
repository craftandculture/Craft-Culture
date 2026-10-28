'use client';

import { IconCheck, IconRefresh, IconX } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import { useState } from 'react';
import { toast } from 'sonner';

import AdminPageHeader from '@/app/_admin/components/AdminPageHeader';
import ConfirmAction from '@/app/_cellar/components/ConfirmAction';
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
  completed: 'bg-emerald-100 text-emerald-800',
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
  const [reverseReason, setReverseReason] = useState('');

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

  const { mutate: reverse, isPending: isReversing } = useMutation(
    api.consignment.admin.reversePurchase.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          `${result.purchaseNumber} reversed — the wine is back in our stock and on sale.`,
        );
        setReverseReason('');
        setOpenId(null);
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const { mutate: recost, isPending: isRecosting } = useMutation(
    api.consignment.admin.recostPartnerSettlements.mutationOptions({
      onSuccess: (result) => {
        if (result.priced > 0) {
          toast.success(
            `Priced at landed cost and released to the next payout run${result.stillHeld > 0 ? `; ${result.stillHeld} still has no cost` : ''}.`,
          );
        } else {
          toast.error(
            'Still no import price in the Pricing Manager for this wine. Set it there, then check again.',
          );
        }
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
      <AdminPageHeader
        title="Cellar purchases"
        description="Members buying wine in bond. Nothing moves until you confirm the money landed."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            isDisabled={isRefetching}
          >
            <ButtonContent iconLeft={IconRefresh}>Refresh</ButtonContent>
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap gap-1.5">
        {filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setStatus(filter.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              status === filter.id
                ? 'bg-text-primary text-surface-primary'
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
                    {purchase.settlesToPartners && ' · settles to a partner'}
                    {purchase.paymentClaimedAt
                      ? ` · claimed ${formatDistanceToNowStrict(new Date(purchase.paymentClaimedAt), { addSuffix: true })}`
                      : purchase.reservedUntil
                        ? new Date(purchase.reservedUntil) < new Date()
                          ? ` · hold ended ${formatDistanceToNowStrict(new Date(purchase.reservedUntil), { addSuffix: true })}`
                          : ` · held for another ${formatDistanceToNowStrict(new Date(purchase.reservedUntil))}`
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
                              {item.settlesTo}
                              {item.owedToPartnerUsd !== null &&
                                ` · owed ${money(item.owedToPartnerUsd)}`}
                              {item.costToConfirm && (
                                <span className="ml-1.5 rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                                  Cost to confirm
                                </span>
                              )}
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
                        {purchase.settlesToMembers || purchase.settlesToPartners
                          ? ', and whoever these parcels belonged to — a member at their asking price, a partner at landed cost — is owed for them on the next payout run.'
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
                        <ConfirmAction
                          title={`Confirm payment for ${purchase.purchaseNumber}?`}
                          description={
                            <>
                              <p>
                                Only confirm once the money is in the bank.
                                The wine moves into {purchase.buyerName}&apos;s
                                cellar straight away, and any member whose wine
                                it was is recorded as owed.
                              </p>
                              {!claimed && (
                                <p>
                                  They have not said they have paid yet.
                                </p>
                              )}
                            </>
                          }
                          confirmLabel="Confirm and transfer"
                          onConfirm={() =>
                            confirm({
                              purchaseId: purchase.id,
                              paymentReference: reference || undefined,
                            })
                          }
                        >
                          {/* Near-black, the house action colour; teal is not used in Index */}
                          <button
                            type="button"
                            disabled={isPending}
                            className="bg-text-primary text-surface-primary inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold disabled:opacity-50"
                          >
                            <IconCheck size={14} />
                            Confirm payment &amp; transfer
                          </button>
                        </ConfirmAction>
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
                    <div className="flex flex-wrap items-center gap-2">
                      <Typography variant="bodyXs" colorRole="muted">
                        {purchase.status === 'completed'
                          ? `Transferred${purchase.paymentConfirmedAt ? ` ${formatDistanceToNowStrict(new Date(purchase.paymentConfirmedAt), { addSuffix: true })}` : ''}.`
                          : `This purchase is ${STATE_LABELS[purchase.status] ?? purchase.status}.`}
                      </Typography>
                      {/*
                        A sale made in error, a refund, or a test. The wine goes
                        back to whoever sold it and back on sale; the reason is
                        written on the purchase.
                      */}
                      {purchase.status === 'completed' && (
                        <span className="ml-auto flex items-center gap-2">
                          {/* A partner owed nothing yet because their wine had no cost set */}
                          {purchase.items.some((item) => item.costToConfirm) && (
                            <button
                              type="button"
                              disabled={isRecosting}
                              onClick={() => recost({ purchaseId: purchase.id })}
                              className="bg-text-primary text-surface-primary inline-flex h-9 items-center rounded-lg px-3 text-xs font-semibold disabled:opacity-50"
                            >
                              Recheck cost
                            </button>
                          )}
                          <Input
                            value={reverseReason}
                            onChange={(event) => setReverseReason(event.target.value)}
                            placeholder="Why it is being reversed"
                            className="max-w-[240px]"
                          />
                          <ConfirmAction
                            title={`Reverse ${purchase.purchaseNumber}?`}
                            description={
                              <p>
                                The wine moves out of {purchase.buyerName}&apos;s
                                cellar, back to whoever sold it, and goes back on
                                sale. {purchase.buyerName} is told it was
                                cancelled. Any refund is made separately.
                              </p>
                            }
                            confirmLabel="Reverse purchase"
                            tone="danger"
                            onConfirm={() =>
                              reverse({
                                purchaseId: purchase.id,
                                reason: reverseReason.trim(),
                              })
                            }
                          >
                            <button
                              type="button"
                              disabled={isReversing || reverseReason.trim().length < 3}
                              className="text-text-muted inline-flex h-9 items-center gap-1 rounded px-2 text-xs font-medium transition-colors hover:text-red-700 disabled:opacity-40"
                            >
                              <Icon icon={IconX} size="xs" />
                              Reverse purchase
                            </button>
                          </ConfirmAction>
                        </span>
                      )}
                    </div>
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
