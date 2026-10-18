'use client';

import { IconChevronDown, IconMinus, IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useState } from 'react';
import { toast } from 'sonner';

import ConfirmAction from '@/app/_cellar/components/ConfirmAction';
import Icon from '@/app/_ui/components/Icon/Icon';
import useTRPC from '@/lib/trpc/browser';

const money = (value: number) =>
  `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const caseLabel = (cases: number, caseConfig: number) =>
  caseConfig > 1
    ? `${cases} ${cases === 1 ? 'case' : 'cases'} of ${caseConfig}`
    : `${cases} ${cases === 1 ? 'bottle' : 'bottles'}`;

const holdLabel = (holdAt: string) =>
  holdAt === 'uk' ? 'Held in the UK at London City Bond' : 'Held in your cellar in the UAE';

/* Where accepted wine appears, so UK wine is not promised to the UAE cellar */
const landsIn = (holdAt: string | null | undefined) =>
  holdAt === 'uk'
    ? 'it appears under the United Kingdom in your cellar once your payment arrives'
    : 'it is added to your cellar once your payment arrives';

/* What each request state means to the collector */
const REQUEST_STATES: Record<string, { label: string; tone: string }> = {
  requested: { label: 'Request received', tone: 'bg-surface-muted text-text-muted ring-border-muted' },
  searching: {
    label: 'Looking for it',
    tone: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-900',
  },
  offer_sent: {
    label: 'Found for you',
    tone: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-900',
  },
  offer_expired: { label: 'Offer lapsed', tone: 'bg-surface-muted text-text-muted ring-border-muted' },
  accepted: {
    label: 'Accepted',
    tone: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-900',
  },
  declined: { label: 'Declined', tone: 'bg-surface-muted text-text-muted ring-border-muted' },
  withdrawn: { label: 'Withdrawn', tone: 'bg-surface-muted text-text-muted ring-border-muted' },
  closed: { label: 'Closed', tone: 'bg-surface-muted text-text-muted ring-border-muted' },
};

const OPEN_REQUESTS = ['requested', 'searching', 'offer_sent', 'offer_expired', 'accepted'];

export interface MemberSourcingPanelProps {
  /** Opens the activation sheet when an action needs an active cellar */
  onActivationError: (error: { message: string }) => boolean;
}

/**
 * Wines offered to members first, and wines a member asked us to find
 *
 * Sits above the catalogue on Available now and is absent when there is
 * nothing to show. An allocation leads with the wine; the price is the wine's
 * price per bottle and never anything else.
 */
const MemberSourcingPanel = ({ onActivationError }: MemberSourcingPanelProps) => {
  const api = useTRPC();
  const [interestCases, setInterestCases] = useState<Record<string, number>>({});
  const [showEarlier, setShowEarlier] = useState(false);

  const { data, refetch } = useQuery({
    ...api.cellarSourcing.member.get.queryOptions(),
  });

  const onError = (error: { message: string }) =>
    onActivationError(error) || toast.error(error.message);

  const { mutate: registerInterest, isPending: isRegistering } = useMutation(
    api.cellarSourcing.member.registerInterest.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          result.status === 'withdrawn'
            ? 'Your interest has been withdrawn.'
            : 'Thank you. We will let you know your allocation.',
        );
        void refetch();
      },
      onError,
    }),
  );

  const { mutate: respondAllocation, isPending: isConfirming } = useMutation(
    api.cellarSourcing.member.respondAllocation.mutationOptions({
      onSuccess: (result, variables) => {
        toast.success(
          variables.response === 'decline'
            ? 'Thank you for letting us know.'
            : result.purchaseNumber
              ? `Reserved as ${result.purchaseNumber}. Your Purchases page has how to pay.`
              : 'Confirmed. We will be in touch with how to pay.',
        );
        void refetch();
      },
      onError,
    }),
  );

  const { mutate: respondOffer, isPending: isResponding } = useMutation(
    api.cellarSourcing.member.respondOffer.mutationOptions({
      onSuccess: (result, variables) => {
        toast.success(
          variables.response === 'decline'
            ? 'Thank you for letting us know.'
            : result.purchaseNumber
              ? `Reserved as ${result.purchaseNumber}. Your Purchases page has how to pay.`
              : 'Accepted. We will be in touch with how to pay.',
        );
        void refetch();
      },
      onError,
    }),
  );

  const { mutate: withdrawRequest, isPending: isWithdrawing } = useMutation(
    api.cellarSourcing.member.withdrawRequest.mutationOptions({
      onSuccess: () => {
        toast.success('Your request has been withdrawn.');
        void refetch();
      },
      onError,
    }),
  );

  const allocations = data?.allocations ?? [];
  const requests = data?.requests ?? [];
  const current = requests.filter((request) => OPEN_REQUESTS.includes(request.status));
  const earlier = requests.filter(
    (request) => !OPEN_REQUESTS.includes(request.status) && request.status !== 'withdrawn',
  );

  if (allocations.length === 0 && requests.length === 0) return null;

  return (
    <div className="mb-5 space-y-4">
      {allocations.length > 0 && (
        <section className="border-border-muted bg-surface-primary overflow-hidden rounded-xl border shadow-sm">
          <header className="border-border-muted border-b px-4 py-2.5">
            <p className="text-text-primary text-[11px] font-semibold uppercase tracking-wider">
              Offered to members first
            </p>
          </header>
          <ul className="divide-border-muted divide-y">
            {allocations.map((allocation) => {
              const interest = allocation.myInterest;
              const max = allocation.maxCasesPerMember ?? 99;
              const chosen =
                interestCases[allocation.id] ??
                (interest && interest.status === 'interested' ? interest.casesRequested : 1);
              const canRegister =
                allocation.isOpen &&
                (!interest || ['interested', 'withdrawn'].includes(interest.status));

              return (
                <li key={allocation.id} className="px-4 py-3.5">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold leading-snug text-emerald-800 dark:text-emerald-300">
                        {allocation.wineName}
                        {allocation.vintage ? ` ${allocation.vintage}` : ''}
                      </p>
                      <p className="text-text-muted mt-0.5 text-sm">
                        {[
                          allocation.producer,
                          allocation.format,
                          allocation.caseConfig > 1 ? `case of ${allocation.caseConfig}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {allocation.description && (
                        <p className="text-text-muted mt-1 max-w-[68ch] text-xs leading-5">
                          {allocation.description}
                        </p>
                      )}
                      <p className="text-text-muted mt-1 text-xs">
                        {[
                          allocation.deliveryNote,
                          holdLabel(allocation.holdAt),
                          allocation.closesAt && allocation.isOpen
                            ? `Closes ${format(new Date(allocation.closesAt), 'd MMM yyyy')}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <p className="text-text-primary flex-shrink-0 text-base font-bold tabular-nums sm:text-right">
                      {money(allocation.pricePerBottleUsd)}
                      <span className="text-text-muted block text-[11px] font-normal">a bottle</span>
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {canRegister && (
                      <>
                        <span className="border-border-muted inline-flex h-9 items-center rounded-lg border">
                          <button
                            type="button"
                            aria-label="Fewer"
                            disabled={chosen <= 1}
                            onClick={() =>
                              setInterestCases((value) => ({ ...value, [allocation.id]: chosen - 1 }))
                            }
                            className="flex h-full w-8 items-center justify-center disabled:opacity-30"
                          >
                            <Icon icon={IconMinus} size="xs" />
                          </button>
                          <span className="min-w-[88px] px-1 text-center text-xs font-semibold tabular-nums">
                            {caseLabel(chosen, allocation.caseConfig)}
                          </span>
                          <button
                            type="button"
                            aria-label="More"
                            disabled={chosen >= max}
                            onClick={() =>
                              setInterestCases((value) => ({ ...value, [allocation.id]: chosen + 1 }))
                            }
                            className="flex h-full w-8 items-center justify-center disabled:opacity-30"
                          >
                            <Icon icon={IconPlus} size="xs" />
                          </button>
                        </span>
                        <button
                          type="button"
                          disabled={isRegistering}
                          onClick={() =>
                            registerInterest({ allocationId: allocation.id, cases: chosen })
                          }
                          className="bg-text-primary text-surface-primary h-9 rounded-lg px-3.5 text-xs font-semibold disabled:opacity-50"
                        >
                          {interest?.status === 'interested' ? 'Update my request' : 'Request an allocation'}
                        </button>
                        {interest?.status === 'interested' && (
                          <button
                            type="button"
                            disabled={isRegistering}
                            onClick={() => registerInterest({ allocationId: allocation.id, cases: 0 })}
                            className="text-text-muted hover:text-text-primary h-9 px-2 text-xs font-semibold"
                          >
                            Withdraw
                          </button>
                        )}
                      </>
                    )}

                    {interest?.status === 'interested' && (
                      <span className="text-text-muted text-xs">
                        You asked for {caseLabel(interest.casesRequested, allocation.caseConfig)}. We will let
                        you know your allocation.
                      </span>
                    )}

                    {interest?.status === 'allocated' && interest.casesAllocated && (
                      <>
                        <span className="text-text-primary text-sm">
                          We have set aside{' '}
                          <strong>{caseLabel(interest.casesAllocated, allocation.caseConfig)}</strong> for you
                          {' · '}
                          {money(
                            interest.casesAllocated *
                              allocation.caseConfig *
                              allocation.pricePerBottleUsd,
                          )}
                        </span>
                        <ConfirmAction
                          title="Confirm your allocation?"
                          description={
                            <p>
                              {caseLabel(interest.casesAllocated, allocation.caseConfig)} of{' '}
                              {allocation.wineName}
                              {allocation.vintage ? ` ${allocation.vintage}` : ''} at{' '}
                              {money(allocation.pricePerBottleUsd)} a bottle. We will send you the
                              details to pay, and {landsIn(allocation.holdAt)}.
                            </p>
                          }
                          confirmLabel="Confirm allocation"
                          onConfirm={() =>
                            respondAllocation({ interestId: interest.id, response: 'confirm' })
                          }
                        >
                          <button
                            type="button"
                            disabled={isConfirming}
                            className="h-9 rounded-lg bg-emerald-700 px-3.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                          >
                            Confirm
                          </button>
                        </ConfirmAction>
                        <ConfirmAction
                          title="Decline this allocation?"
                          description={<p>The wine will be offered to other members.</p>}
                          confirmLabel="Decline"
                          tone="danger"
                          onConfirm={() =>
                            respondAllocation({ interestId: interest.id, response: 'decline' })
                          }
                        >
                          <button
                            type="button"
                            disabled={isConfirming}
                            className="text-text-muted hover:text-text-primary h-9 px-2 text-xs font-semibold"
                          >
                            Decline
                          </button>
                        </ConfirmAction>
                      </>
                    )}

                    {interest?.status === 'confirmed' && (
                      <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                        Confirmed · {caseLabel(interest.casesAllocated ?? 0, allocation.caseConfig)}
                      </span>
                    )}

                    {interest?.status === 'unallocated' && (
                      <span className="text-text-muted text-xs">
                        Demand was greater than the wine available, and we were not able to allocate any to
                        you this time.
                      </span>
                    )}

                    {interest?.status === 'declined' && (
                      <span className="text-text-muted text-xs">You declined this allocation.</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {requests.length > 0 && (current.length > 0 || earlier.length > 0) && (
        <section className="border-border-muted bg-surface-primary overflow-hidden rounded-xl border shadow-sm">
          <header className="border-border-muted border-b px-4 py-2.5">
            <p className="text-text-primary text-[11px] font-semibold uppercase tracking-wider">
              Wines you asked us to find
            </p>
          </header>
          <ul className="divide-border-muted divide-y">
            {[...current, ...(showEarlier ? earlier : [])].map((request) => {
              const state = REQUEST_STATES[request.status] ?? REQUEST_STATES.requested!;
              const offer = request.offer;

              return (
                <li key={request.id} className="px-4 py-3.5">
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                        {request.wineName}
                      </p>
                      <p className="text-text-muted mt-0.5 text-xs">
                        {[
                          request.vintages,
                          `${request.bottles} ${request.bottles === 1 ? 'bottle' : 'bottles'}`,
                          request.format,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                        <span className="text-text-muted/70"> · {request.requestNumber}</span>
                      </p>
                      {request.staffNote && (
                        <p className="text-text-muted mt-1 max-w-[68ch] text-xs leading-5">{request.staffNote}</p>
                      )}
                    </div>
                    <span
                      className={`w-fit flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${state.tone}`}
                    >
                      {state.label}
                    </span>
                  </div>

                  {offer && request.status === 'offer_sent' && (
                    <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/40 px-3.5 py-3 dark:border-emerald-900/50 dark:bg-emerald-500/5">
                      <p className="text-text-primary text-sm font-semibold">
                        {offer.wineName}
                        {offer.vintage ? ` ${offer.vintage}` : ''}
                      </p>
                      <p className="text-text-muted mt-0.5 text-xs">
                        {[
                          caseLabel(offer.cases, offer.caseConfig),
                          `${money(offer.pricePerBottleUsd)} a bottle`,
                          holdLabel(offer.holdAt),
                          offer.validUntil
                            ? `Open until ${format(new Date(offer.validUntil), 'd MMM yyyy')}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {offer.note && <p className="text-text-muted mt-1 text-xs leading-5">{offer.note}</p>}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-text-primary mr-auto text-base font-bold tabular-nums">
                          {money(offer.cases * offer.caseConfig * offer.pricePerBottleUsd)}
                        </span>
                        <ConfirmAction
                          title="Accept this wine?"
                          description={
                            <p>
                              {caseLabel(offer.cases, offer.caseConfig)} of {offer.wineName}
                              {offer.vintage ? ` ${offer.vintage}` : ''} at {money(offer.pricePerBottleUsd)} a
                              bottle. We will send you the details to pay, and {landsIn(offer.holdAt)}.
                            </p>
                          }
                          confirmLabel="Accept"
                          onConfirm={() => respondOffer({ requestId: request.id, response: 'accept' })}
                        >
                          <button
                            type="button"
                            disabled={isResponding}
                            className="h-9 rounded-lg bg-emerald-700 px-3.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                          >
                            Accept
                          </button>
                        </ConfirmAction>
                        <ConfirmAction
                          title="Decline this wine?"
                          description={<p>We will let the team know. You can ask us to keep looking.</p>}
                          confirmLabel="Decline"
                          tone="danger"
                          onConfirm={() => respondOffer({ requestId: request.id, response: 'decline' })}
                        >
                          <button
                            type="button"
                            disabled={isResponding}
                            className="text-text-muted hover:text-text-primary h-9 px-2 text-xs font-semibold"
                          >
                            Decline
                          </button>
                        </ConfirmAction>
                      </div>
                    </div>
                  )}

                  {request.status === 'offer_expired' && (
                    <p className="text-text-muted mt-2 text-xs">
                      This offer has lapsed. Please contact us if you would still like the wine.
                    </p>
                  )}

                  {request.status === 'accepted' && (
                    <p className="text-text-muted mt-2 text-xs">
                      We will send you the details to pay, and {landsIn(request.offer?.holdAt ?? request.holdAt)}.
                    </p>
                  )}

                  {['requested', 'searching'].includes(request.status) && (
                    <ConfirmAction
                      title="Withdraw this request?"
                      description={<p>We will stop looking for this wine.</p>}
                      confirmLabel="Withdraw request"
                      tone="danger"
                      onConfirm={() => withdrawRequest({ requestId: request.id })}
                    >
                      <button
                        type="button"
                        disabled={isWithdrawing}
                        className="text-text-muted hover:text-text-primary mt-2 text-xs font-semibold"
                      >
                        Withdraw
                      </button>
                    </ConfirmAction>
                  )}
                </li>
              );
            })}
          </ul>
          {earlier.length > 0 && (
            <button
              type="button"
              onClick={() => setShowEarlier((value) => !value)}
              className="text-text-muted hover:text-text-primary border-border-muted flex w-full items-center justify-center gap-1 border-t px-4 py-2.5 text-xs font-semibold"
            >
              {showEarlier ? 'Hide earlier requests' : `Earlier requests (${earlier.length})`}
              <Icon icon={IconChevronDown} size="xs" className={showEarlier ? 'rotate-180' : ''} />
            </button>
          )}
        </section>
      )}
    </div>
  );
};

export default MemberSourcingPanel;
