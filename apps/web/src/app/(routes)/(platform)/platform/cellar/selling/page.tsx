'use client';

import { IconTag } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import { toast } from 'sonner';

import { COMMISSION_RATES } from '@/app/_consignment/constants/commissionRates';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

const money = (value: number) =>
  `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/*
  What each state means to the member, in their words rather than ours. The
  status column is the only place most of them will ever read about the
  difference between listed and placed, so it has to carry the consequence and
  not just the name.
*/
const STATES: Record<
  string,
  { label: string; tone: 'held' | 'live' | 'gone'; detail: string }
> = {
  offered: {
    label: 'With us for review',
    tone: 'held',
    detail: 'We are looking at it. You can still withdraw.',
  },
  listed: {
    label: 'On the lists',
    tone: 'live',
    detail: 'Offered to our trade and private clients. You can still withdraw.',
  },
  placed: {
    label: 'With a distributor',
    tone: 'gone',
    detail: 'Out of bond and on sale. It can no longer be withdrawn.',
  },
  partially_sold: {
    label: 'Part sold',
    tone: 'gone',
    detail: 'Some has sold. The rest is still on offer.',
  },
  sold: { label: 'Sold', tone: 'gone', detail: 'Settled on the next payment run.' },
  withdrawn: { label: 'Withdrawn', tone: 'held', detail: 'Back in your cellar.' },
  expired: { label: 'Expired', tone: 'held', detail: 'Back in your cellar.' },
  draft: {
    label: 'Sent back',
    tone: 'held',
    detail: 'We have asked for a change before we can list it.',
  },
};

const TONES = {
  held: 'bg-teal-50 text-teal-700',
  live: 'bg-violet-50 text-violet-700',
  gone: 'bg-amber-50 text-amber-800',
};

/**
 * What a member has offered for sale, and where it has got to
 *
 * Kept apart from the cellar itself because the questions are different: the
 * cellar answers "what do I own", this answers "what did I ask you to sell and
 * what happened". Wine under offer still appears in the cellar — it has not
 * gone anywhere — but it is not what a member comes here to check.
 */
const SellingPage = () => {
  const api = useTRPC();

  const { data, isLoading, refetch } = useQuery({
    ...api.consignment.member.getMandates.queryOptions(),
  });

  const { mutate: withdraw, isPending } = useMutation(
    api.consignment.member.withdrawMandate.mutationOptions({
      onSuccess: (result) => {
        toast.success(`${result.mandateNumber} withdrawn — it is back in your cellar.`);
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const mandates = data?.mandates ?? [];

  return (
    <div className="w-full pb-8">
      {/*
        headingMd, like the cellar and Available now. Three tabs had three
        different heading sizes, so moving between them made the page look like
        it was jumping.
      */}
      <div className="mb-4">
        <Typography variant="headingMd" className="block">
          Selling
        </Typography>
        <Typography variant="bodyXs" colorRole="muted" className="mt-0.5 block">
          Wine you have asked us to sell on your behalf. You receive your ask in
          full &mdash; our commission is added on top of it, not taken out of
          it.
        </Typography>
      </div>

      {isLoading && (
        <Typography variant="bodySm" colorRole="muted" className="mt-6 block">
          Loading&hellip;
        </Typography>
      )}

      {!isLoading && mandates.length === 0 && (
        <div className="border-border-muted mt-6 rounded-xl border px-6 py-14 text-center">
          <Icon icon={IconTag} size="lg" className="text-text-muted mx-auto mb-3" />
          <Typography variant="bodyMd" colorRole="muted" className="block">
            Nothing offered for sale.
          </Typography>
          <Typography variant="bodyXs" colorRole="muted" className="mt-1 block">
            Choose bottles in your cellar and press Sell to offer them.
          </Typography>
        </div>
      )}

      {!isLoading && mandates.length > 0 && (
        <div className="border-border-muted mt-6 overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="text-text-muted border-border-muted border-b text-[10px] uppercase tracking-wider">
                <th className="px-4 py-2 text-left">Wine</th>
                <th className="px-3 py-2 text-right">Bottles</th>
                <th className="px-3 py-2 text-right">Your ask</th>
                <th className="px-3 py-2 text-right">Buyer pays</th>
                <th className="px-3 py-2 text-right">You receive</th>
                <th className="px-3 py-2 text-left">State</th>
                <th className="px-4 py-2 text-right" />
              </tr>
            </thead>
            <tbody>
              {mandates.map((mandate) => {
                const state = STATES[mandate.status] ?? {
                  label: mandate.status,
                  tone: 'held' as const,
                  detail: '',
                };

                const canWithdraw = ['offered', 'listed'].includes(
                  mandate.status,
                );

                return (
                  <tr
                    key={mandate.id}
                    className="border-border-muted border-b last:border-b-0"
                  >
                    <td className="px-4 py-3">
                      <Typography variant="bodySm" className="font-medium">
                        {mandate.productName}
                      </Typography>
                      <Typography
                        variant="bodyXs"
                        colorRole="muted"
                        className="block"
                      >
                        <span className="font-mono">{mandate.mandateNumber}</span>
                        {mandate.offeredAt
                          ? ` · offered ${formatDistanceToNowStrict(new Date(mandate.offeredAt), { addSuffix: true })}`
                          : ''}
                      </Typography>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {mandate.bottlesRemaining}
                      {mandate.bottlesRemaining !== mandate.bottlesOffered && (
                        <span className="text-text-muted text-xs">
                          {' '}
                          of {mandate.bottlesOffered}
                        </span>
                      )}
                    </td>
                    <td className="text-text-muted px-3 py-3 text-right tabular-nums">
                      {money(mandate.askPerBottleUsd)}
                      <span className="text-text-muted block text-[11px]">
                        per bottle
                      </span>
                    </td>
                    {/*
                      The margin, disclosed rather than discovered. A member who
                      finds their $210 on our list at $221 having never been
                      told is right to ask why; the rate depends on who buys, so
                      it is a range until one does.
                    */}
                    <td className="text-text-muted px-3 py-3 text-right tabular-nums">
                      {money(
                        mandate.askPerBottleUsd /
                          (1 - COMMISSION_RATES.collector / 100),
                      )}
                      <span className="text-text-muted">&ndash;</span>
                      {money(
                        mandate.askPerBottleUsd /
                          (1 - COMMISSION_RATES.trade / 100),
                      )}
                      <span className="text-text-muted block text-[11px]">
                        {COMMISSION_RATES.collector}% collector &middot;{' '}
                        {COMMISSION_RATES.trade}% trade
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">
                      {money(
                        mandate.askPerBottleUsd * mandate.bottlesRemaining,
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONES[state.tone]}`}
                      >
                        {state.label}
                      </span>
                      <Typography
                        variant="bodyXs"
                        colorRole="muted"
                        className="mt-1 block max-w-[34ch]"
                      >
                        {mandate.status === 'draft' && mandate.adminNotes
                          ? mandate.adminNotes
                          : state.detail}
                      </Typography>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canWithdraw ? (
                        <Button
                          size="sm"
                          variant="outline"
                          isDisabled={isPending}
                          onClick={() => withdraw({ mandateId: mandate.id })}
                        >
                          <ButtonContent>Withdraw</ButtonContent>
                        </Button>
                      ) : (
                        /*
                          A sentence, not a disabled button. A greyed control
                          invites a click to find out why it is greyed.
                        */
                        <Typography variant="bodyXs" colorRole="muted">
                          {mandate.status === 'placed' ||
                          mandate.status === 'partially_sold'
                            ? 'Cannot be withdrawn'
                            : '—'}
                        </Typography>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SellingPage;
