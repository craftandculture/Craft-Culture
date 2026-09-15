'use client';

import { IconCheck, IconRefresh, IconX } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import { useState } from 'react';
import { toast } from 'sonner';

import { COMMISSION_RATES } from '@/app/_consignment/constants/commissionRates';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import displayWineName from '@/app/_wms/utils/displayWineName';
import useTRPC from '@/lib/trpc/browser';

type StatusFilter = 'open' | 'all' | 'offered' | 'listed' | 'placed' | 'sold';

const money = (value: number) =>
  `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const STATE_STYLES: Record<string, string> = {
  offered: 'bg-amber-100 text-amber-800',
  listed: 'bg-violet-100 text-violet-800',
  placed: 'bg-teal-100 text-teal-800',
  partially_sold: 'bg-teal-100 text-teal-800',
  sold: 'bg-fill-secondary text-text-muted',
  withdrawn: 'bg-fill-secondary text-text-muted',
};

const STATE_LABELS: Record<string, string> = {
  offered: 'Awaiting review',
  listed: 'On the lists',
  placed: 'With a distributor',
  partially_sold: 'Part sold',
  sold: 'Sold',
  withdrawn: 'Withdrawn',
  draft: 'Sent back',
  expired: 'Expired',
};

/**
 * Members offering wine for C&C to sell
 *
 * Accepting is the only action in the platform that makes a member's wine
 * sellable — it clears the hold on those exact parcels, which puts them on the
 * trade list, the private-client list and the in-app picker at once.
 *
 * The ask is deliberately not editable. If a price will not sell, it goes back
 * with a note and the member re-prices; listing at a different number would
 * leave what they agreed and what is on the shelf disagreeing, with only one of
 * them in writing.
 */
const ConsignmentPage = () => {
  const api = useTRPC();
  const [status, setStatus] = useState<StatusFilter>('open');
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    ...api.consignment.admin.getMandates.queryOptions({ status }),
  });

  const { mutate: decide, isPending } = useMutation(
    api.consignment.admin.decideMandate.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          result.status === 'listed'
            ? `${result.mandateNumber} is on the lists.`
            : result.status === 'send_back'
              ? 'Sent back for a new price.'
              : 'Declined.',
        );
        setOpenId(null);
        setNote('');
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const mandates = data?.mandates ?? [];

  const filters: { id: StatusFilter; label: string }[] = [
    { id: 'open', label: 'Open' },
    { id: 'offered', label: 'Awaiting review' },
    { id: 'listed', label: 'On the lists' },
    { id: 'placed', label: 'With distributors' },
    { id: 'all', label: 'All' },
  ];

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Typography variant="headingLg">Consignment</Typography>
          <Typography variant="bodySm" colorRole="muted" className="mt-1 block">
            Members offering wine for us to sell on their behalf
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

      {/*
        The queue is a decision list, so the header should say how much is
        waiting and what it is worth before anyone starts reading cards. The
        same summary language as the member's Selling tab and the cellar.
      */}
      {!isLoading && mandates.length > 0 && (
        <dl className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          {[
            {
              label: 'Awaiting review',
              value: String(
                mandates.filter((mandate) => mandate.status === 'offered').length,
              ),
              detail: 'need a decision',
            },
            {
              label: 'On the lists',
              value: String(
                mandates.filter((mandate) => mandate.status === 'listed').length,
              ),
              detail: 'live now',
            },
            {
              label: 'Bottles out',
              value: String(
                mandates.reduce(
                  (sum, mandate) => sum + mandate.bottlesRemaining,
                  0,
                ),
              ),
              detail: 'in this view',
            },
            {
              label: 'Owed if it all sells',
              value: money(
                mandates.reduce(
                  (sum, mandate) =>
                    sum + mandate.askPerBottleUsd * mandate.bottlesRemaining,
                  0,
                ),
              ),
              detail: 'to members',
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="border-border-muted rounded-xl border px-3 py-2.5 sm:px-4 sm:py-3"
            >
              <dt className="text-text-muted text-[10px] font-semibold uppercase tracking-[0.08em]">
                {stat.label}
              </dt>
              <dd className="text-text-primary m-0 mt-1 text-lg font-semibold tabular-nums sm:text-xl">
                {stat.value}
              </dd>
              <dd className="text-text-muted m-0 text-[11px]">{stat.detail}</dd>
            </div>
          ))}
        </dl>
      )}

      {isLoading && (
        <Typography variant="bodySm" colorRole="muted">
          Loading&hellip;
        </Typography>
      )}

      {!isLoading && mandates.length === 0 && (
        <div className="border-border-muted rounded-xl border px-6 py-12 text-center">
          <Typography variant="bodyMd" colorRole="muted">
            Nothing waiting.
          </Typography>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {mandates.map((mandate) => {
          const isOpen = openId === mandate.id;
          const awaiting = mandate.status === 'offered';

          /*
            What a buyer would pay. Shown beside the ask so a decision can be
            made on the number that actually goes on the list, rather than on
            the member's net with the margin worked out in somebody's head.
          */
          const listed =
            mandate.askPerBottleUsd /
            (1 -
              Math.max(COMMISSION_RATES.trade, COMMISSION_RATES.collector) /
                100);

          return (
            <div
              key={mandate.id}
              className="border-border-muted overflow-hidden rounded-xl border"
            >
              <button
                type="button"
                onClick={() => {
                  setOpenId(isOpen ? null : mandate.id);
                  setNote('');
                }}
                className="hover:bg-fill-muted/40 flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <Typography variant="bodySm" className="font-semibold">
                    {mandate.ownerName}
                    <span className="text-text-muted ml-2 font-mono text-xs">
                      {mandate.mandateNumber}
                    </span>
                  </Typography>
                  {/*
                    The stored name ends in its own vintage, size and strength —
                    "Dom Pérignon P2 2006 0.75L 12.5%abv" — and the line then
                    printed the vintage again straight after it.
                  */}
                  <Typography
                    variant="bodyXs"
                    colorRole="muted"
                    className="mt-0.5 block"
                  >
                    {displayWineName(mandate.productName)}
                    {' · '}
                    {mandate.vintage ?? 'NV'}
                    {mandate.bottleSize ? ` · ${mandate.bottleSize}` : ''} ·{' '}
                    {mandate.bottlesRemaining}{' '}
                    {mandate.bottlesRemaining === 1 ? 'bottle' : 'bottles'}
                    {mandate.offeredAt
                      ? ` · ${formatDistanceToNowStrict(new Date(mandate.offeredAt), { addSuffix: true })}`
                      : ''}
                  </Typography>
                </div>
                <div className="flex flex-shrink-0 items-center gap-3">
                  <div className="text-right">
                    <Typography variant="bodySm" className="font-semibold tabular-nums">
                      {money(mandate.askPerBottleUsd)}
                      <span className="text-text-muted font-normal"> / btl</span>
                    </Typography>
                    {/*
                      The same two figures the member is shown on their Selling
                      tab. One number here and a range there meant two screens
                      describing one sale differently.
                    */}
                    <Typography variant="bodyXs" colorRole="muted" className="block">
                      lists at {money(listed)}
                    </Typography>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      STATE_STYLES[mandate.status] ??
                      'bg-fill-secondary text-text-muted'
                    }`}
                  >
                    {STATE_LABELS[mandate.status] ?? mandate.status}
                  </span>
                </div>
              </button>

              {isOpen && (
                <div className="border-border-muted bg-fill-muted/30 border-t px-4 py-4">
                  <div className="border-border-muted bg-background-primary mb-4 inline-block max-w-full overflow-x-auto rounded-lg border align-top">
                    <table className="text-sm">
                      <thead>
                        <tr className="text-text-muted border-border-muted border-b text-[10px] uppercase tracking-wider">
                          <th className="px-3 py-1.5 text-left">Lot</th>
                          <th className="px-3 py-1.5 text-left">BOE</th>
                          <th className="px-3 py-1.5 text-right">Bottles</th>
                        </tr>
                      </thead>
                      <tbody className="divide-border-muted/60 divide-y">
                        {mandate.lots.map((lot) => (
                          <tr key={lot.id}>
                            <td className="text-text-muted px-3 py-2 font-mono text-xs">
                              {lot.lotNumber ?? '—'}
                            </td>
                            <td className="text-text-muted px-3 py-2 font-mono text-xs">
                              {lot.reExportBoeNumber ?? '—'}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {lot.bottlesRemaining}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {mandate.ownerNotes && (
                    <Typography
                      variant="bodyXs"
                      colorRole="muted"
                      className="mb-3 block"
                    >
                      &ldquo;{mandate.ownerNotes}&rdquo;
                    </Typography>
                  )}

                  {awaiting ? (
                    <>
                      <label className="mb-3 block">
                        <span className="text-text-muted mb-1 block text-[11px] uppercase tracking-wider">
                          Note to the member &mdash; required to send back
                        </span>
                        <Input
                          value={note}
                          onChange={(event) => setNote(event.target.value)}
                          placeholder="What needs to change before we can list it"
                        />
                      </label>

                      {/*
                        Read before acting, not after. This sat below the row of
                        buttons, where it explained a decision that had already
                        been taken.
                      */}
                      <Typography
                        variant="bodyXs"
                        colorRole="muted"
                        className="mb-3 block max-w-[68ch]"
                      >
                        Accepting clears the hold on these exact parcels, which
                        puts them on the trade list, the private-client list and
                        the in-app picker. The member&rsquo;s price is theirs
                        &mdash; if it will not sell, send it back and let them
                        re-price it.
                      </Typography>

                      {/*
                        Three buttons at equal weight, one of them filled red,
                        made declining the loudest thing on the card — and
                        declining is the rarest of the three and the only one
                        that ends the offer outright. Accept leads, sending back
                        is the ordinary second answer, and Decline recedes to
                        the right where a deliberate reach is needed.
                      */}
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          colorRole="brand"
                          isDisabled={isPending}
                          onClick={() =>
                            decide({
                              mandateId: mandate.id,
                              outcome: 'list',
                              adminNotes: note || undefined,
                            })
                          }
                        >
                          <ButtonContent iconLeft={IconCheck}>
                            Accept &amp; list
                          </ButtonContent>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          isDisabled={isPending || !note.trim()}
                          onClick={() =>
                            decide({
                              mandateId: mandate.id,
                              outcome: 'send_back',
                              adminNotes: note,
                            })
                          }
                        >
                          <ButtonContent>Send back</ButtonContent>
                        </Button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            decide({
                              mandateId: mandate.id,
                              outcome: 'decline',
                              adminNotes: note || undefined,
                            })
                          }
                          className="text-text-muted ml-auto inline-flex items-center gap-1 rounded px-2 py-1.5 text-xs font-medium transition-colors hover:text-red-700 disabled:opacity-40"
                        >
                          <Icon icon={IconX} size="xs" />
                          Decline
                        </button>
                      </div>
                    </>
                  ) : (
                    <Typography variant="bodyXs" colorRole="muted">
                      {mandate.status === 'listed'
                        ? 'On the lists. Placing this with a distributor is not built yet.'
                        : `This offer is ${STATE_LABELS[mandate.status] ?? mandate.status}.`}
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

export default ConsignmentPage;
