'use client';

import { IconCheck, IconRefresh, IconX } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import displayWineName from '@/app/_wms/utils/displayWineName';
import useTRPC from '@/lib/trpc/browser';

type StatusFilter =
  | 'open'
  | 'all'
  | 'submitted'
  | 'under_review'
  | 'revision_requested'
  | 'confirmed'
  | 'cancelled';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Awaiting review',
  under_review: 'Quoted — awaiting member',
  revision_requested: 'Revisions requested',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
};

const STATUS_STYLES: Record<string, string> = {
  submitted: 'bg-amber-100 text-amber-800',
  under_review: 'bg-blue-100 text-blue-800',
  revision_requested: 'bg-purple-100 text-purple-800',
  confirmed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-fill-secondary text-text-muted',
};

/**
 * Release requests awaiting a price
 *
 * A member has asked for wine they already own to be brought out of bond. What
 * is being decided here is what that costs them — clearance and delivery — and
 * whether the list they sent is one we can act on.
 */
const CellarReleasesPage = () => {
  const api = useTRPC();
  const [status, setStatus] = useState<StatusFilter>('open');
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState({
    clearance: '',
    delivery: '',
    service: '',
    extra: '',
    extraLabel: '',
    goods: '',
    rateVersion: '',
    notes: '',
  });
  /* Set the moment an operator types, so a refetch cannot undo their edit. */
  const [isOverridden, setIsOverridden] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    ...api.cellar.admin.getReleases.queryOptions({ status }),
  });

  const { mutate: decide, isPending } = useMutation(
    api.cellar.admin.quoteRelease.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          result.status === 'under_review'
            ? `Quoted — $${result.total?.toLocaleString()} sent to the member`
            : result.status === 'revision_requested'
              ? 'Revisions requested'
              : 'Request cancelled',
        );
        setOpenId(null);
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const requests = data?.requests ?? [];

  const filters: { id: StatusFilter; label: string }[] = [
    { id: 'open', label: 'Open' },
    { id: 'submitted', label: 'Awaiting review' },
    { id: 'under_review', label: 'Awaiting member' },
    { id: 'confirmed', label: 'Confirmed' },
    { id: 'all', label: 'All' },
  ];

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Typography variant="headingLg">Cellar releases</Typography>
          <Typography variant="bodySm" colorRole="muted" className="mt-1 block">
            Member requests to release wine held in bond
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
          Loading requests...
        </Typography>
      )}

      {!isLoading && requests.length === 0 && (
        <div className="border-border-muted rounded-xl border px-6 py-12 text-center">
          <Typography variant="bodyMd" colorRole="muted">
            Nothing waiting.
          </Typography>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {requests.map((request) => {
          const isOpen = openId === request.id;
          const bottles = request.items.reduce(
            (sum, item) => sum + item.bottles,
            0,
          );

          return (
            <div
              key={request.id}
              className="border-border-muted overflow-hidden rounded-xl border"
            >
              <button
                type="button"
                onClick={() => {
                  if (isOpen) {
                    setOpenId(null);
                    return;
                  }

                  /*
                    The member's commercials apply on open. Requiring a click
                    to load figures the platform had already worked out meant
                    every quote was retyped, and a retyped figure is a figure
                    that can differ from the card it is supposed to come from.
                  */
                  setOpenId(request.id);
                  setIsOverridden(false);
                  setForm({
                    clearance: request.suggested?.priced
                      ? String(request.suggested.clearanceTotalUsd)
                      : '',
                    delivery: request.suggested?.priced
                      ? String(request.suggested.deliveryUsd)
                      : '',
                    service: request.suggested?.priced
                      ? String(request.suggested.serviceFeeUsd)
                      : '',
                    extra: '',
                    extraLabel: '',
                    goods: request.suggested?.priced
                      ? String(request.suggested.goodsValueUsd)
                      : '',
                    rateVersion: request.suggested?.version ?? '',
                    notes: '',
                  });
                }}
                className="hover:bg-fill-muted/40 flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <Typography variant="bodySm" className="font-semibold">
                    {request.partnerName ?? 'Unknown member'}
                    <span className="text-text-muted ml-2 font-mono text-xs">
                      {request.requestNumber}
                    </span>
                  </Typography>
                  <Typography
                    variant="bodyXs"
                    colorRole="muted"
                    className="mt-0.5 block"
                  >
                    {request.items.length}{' '}
                    {request.items.length === 1 ? 'wine' : 'wines'} · {bottles}{' '}
                    {bottles === 1 ? 'bottle' : 'bottles'}
                    {request.submittedAt
                      ? ` · submitted ${format(new Date(request.submittedAt), 'd MMM yyyy')}`
                      : ''}
                  </Typography>
                </div>
                <span
                  className={`flex-shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
                    STATUS_STYLES[request.status] ??
                    'bg-fill-secondary text-text-muted'
                  }`}
                >
                  {STATUS_LABELS[request.status] ?? request.status}
                </span>
              </button>

              {isOpen && (
                <div className="border-border-muted bg-fill-muted/30 border-t px-4 py-4">
                  <div className="border-border-muted bg-background-primary mb-4 overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-text-muted border-border-muted border-b text-[11px] uppercase tracking-wider">
                          {/*
                            A width, not just a truncate. max-w-0 with nothing
                            to size against collapsed the column to almost
                            nothing and cut every name to two words.
                          */}
                          <th className="w-[55%] px-3 py-1.5 text-left">Wine</th>
                          <th className="px-3 py-1.5 text-center">Vintage</th>
                          <th className="px-3 py-1.5 text-center">Format</th>
                          <th className="px-3 py-1.5 text-left">Lot</th>
                          <th className="px-3 py-1.5 text-right">Quantity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-border-muted/60 divide-y">
                        {request.items.map((item) => (
                          <tr key={item.id}>
                            {/*
                              The stored name ends in its own vintage, size and
                              strength, and this table has columns for two of
                              them — so every row read the vintage twice and
                              carried an abv nobody is deciding on.
                            */}
                            <td className="w-[55%] max-w-0 px-3 py-2">
                              <span
                                className="block truncate"
                                title={item.productName}
                              >
                                {displayWineName(item.productName)}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center tabular-nums">
                              {item.vintage ?? 'NV'}
                            </td>
                            {/*
                              Pack and format together. A six of 75cl and a
                              three of magnums are different things to pick,
                              carry and clear, and 'Size' alone said neither.
                            */}
                            <td className="px-3 py-2 text-center">
                              {item.bottleSize
                                ? item.caseConfig && item.caseConfig > 1
                                  ? `${item.caseConfig}×${item.bottleSize}`
                                  : item.bottleSize
                                : '—'}
                            </td>
                            {/*
                              The parcel the member picked, not a parcel of the
                              same wine. These are their bottles.
                            */}
                            <td className="text-text-muted px-3 py-2 font-mono text-xs">
                              {item.lotNumber ?? '—'}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold tabular-nums">
                              {item.caseConfig &&
                              item.caseConfig > 1 &&
                              item.bottles % item.caseConfig === 0
                                ? `${item.bottles / item.caseConfig} × ${item.caseConfig}`
                                : `${item.bottles} btl`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {request.deliveryAddress && (
                    <div className="mb-3">
                      <Typography variant="bodyXs" colorRole="muted">
                        Deliver to
                      </Typography>
                      <Typography variant="bodySm">
                        {request.deliveryAddress}
                      </Typography>
                    </div>
                  )}

                  {request.memberNotes && (
                    <div className="mb-4">
                      <Typography variant="bodyXs" colorRole="muted">
                        Member notes
                      </Typography>
                      <Typography variant="bodySm">
                        {request.memberNotes}
                      </Typography>
                    </div>
                  )}

                  {request.status === 'confirmed' ? (
                    <Typography variant="bodySm" colorRole="muted">
                      Accepted by the member on{' '}
                      {request.confirmedAt
                        ? format(new Date(request.confirmedAt), 'd MMMM yyyy')
                        : '—'}{' '}
                      · total ${request.totalCostUsd?.toLocaleString() ?? 0}
                    </Typography>
                  ) : (
                    <>
                      <div className="mb-3 flex flex-wrap items-center gap-3">
                        <Typography
                          variant="bodyXs"
                          colorRole="muted"
                          className="font-semibold uppercase tracking-wider"
                        >
                          Quote
                        </Typography>
                        {request.suggested?.priced ? (
                          <>
                            <Typography variant="bodyXs" colorRole="muted">
                              {isOverridden
                                ? 'Overridden'
                                : 'Member rate card'}{' '}
                              &middot; {request.suggested.version}
                            </Typography>
                            {isOverridden && (
                              <button
                                type="button"
                                onClick={() => {
                                  setIsOverridden(false);
                                  setForm((current) => ({
                                    ...current,
                                    clearance: String(
                                      request.suggested.clearanceTotalUsd,
                                    ),
                                    delivery: String(
                                      request.suggested.deliveryUsd,
                                    ),
                                    service: String(
                                      request.suggested.serviceFeeUsd,
                                    ),
                                    goods: String(
                                      request.suggested.goodsValueUsd,
                                    ),
                                    rateVersion: request.suggested.version,
                                  }));
                                }}
                                className="text-text-brand text-xs font-medium hover:underline"
                              >
                                Restore rate card
                              </button>
                            )}
                          </>
                        ) : (
                          <Typography variant="bodyXs" colorRole="muted">
                            No rate card configured for this member or as a
                            house default &mdash; enter the figures manually
                          </Typography>
                        )}
                      </div>

                      {request.suggested?.priced && (
                        <Typography
                          variant="bodyXs"
                          colorRole="muted"
                          className="mb-3 block"
                        >
                          Card {request.suggested.version} on goods valued at{' '}
                          {request.suggested.goodsValueUsd}: duty{' '}
                          {request.suggested.dutyUsd} &middot; transfer{' '}
                          {request.suggested.transferUsd}
                          {/*
                            Only when a case is actually broken. Showing a zero
                            repack on every whole-case release would make the
                            line longer and say nothing.
                          */}
                          {request.suggested.repackUsd > 0 && (
                            <> &middot; repack {request.suggested.repackUsd}</>
                          )}{' '}
                          &middot; distributor{' '}
                          {request.suggested.distributorMarginUsd} &middot;
                          delivery {request.suggested.deliveryUsd} &middot; VAT{' '}
                          {request.suggested.vatUsd} &middot;{' '}
                          <strong className="text-text-brand">
                            C&amp;C {request.suggested.ccMarginUsd}
                          </strong>
                        </Typography>
                      )}
                      <div className="mb-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {[
                          { key: 'clearance', label: 'Duty, VAT & clearance $' },
                          { key: 'delivery', label: 'Delivery $' },
                          { key: 'service', label: 'Service fee $' },
                          { key: 'extra', label: 'Additional charge $' },
                          /*
                            Text, not money. Both of these were getting the
                            0.00 placeholder because only rateVersion was
                            special-cased, so a field asking what a charge is
                            for invited a number.
                          */
                          {
                            key: 'extraLabel',
                            label: 'What it is for',
                            placeholder: 'Repack, storage, courier…',
                          },
                          { key: 'goods', label: 'Goods value $' },
                          {
                            key: 'rateVersion',
                            label: 'Rate version',
                            placeholder: '2026-Q3',
                          },
                        ].map((field) => (
                          <label key={field.key} className="block">
                            <span className="text-text-muted mb-1 block text-[11px] uppercase tracking-wider">
                              {field.label}
                            </span>
                            <Input
                              value={form[field.key as keyof typeof form]}
                              onChange={(event) => {
                                if (field.key !== 'extra' && field.key !== 'extraLabel') {
                                  setIsOverridden(true);
                                }

                                setForm((current) => ({
                                  ...current,
                                  [field.key]: event.target.value,
                                }));
                              }
                              }
                              placeholder={field.placeholder ?? '0.00'}
                            />
                          </label>
                        ))}
                      </div>

                      <label className="mb-3 block">
                        <span className="text-text-muted mb-1 block text-[11px] uppercase tracking-wider">
                          Note to the member — required to request revisions
                        </span>
                        <Input
                          value={form.notes}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              notes: event.target.value,
                            }))
                          }
                          placeholder="Anything they should know before accepting"
                        />
                      </label>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          isDisabled={isPending}
                          onClick={() =>
                            decide({
                              requestId: request.id,
                              outcome: 'quote',
                              clearanceCostUsd: Number(form.clearance) || 0,
                              deliveryCostUsd: Number(form.delivery) || 0,
                              serviceFeeUsd: Number(form.service) || 0,
                              additionalChargeUsd: Number(form.extra) || 0,
                              additionalChargeLabel:
                                form.extraLabel || undefined,
                              goodsValueUsd: Number(form.goods) || 0,
                              clearanceRateVersion: form.rateVersion || undefined,
                              adminNotes: form.notes || undefined,
                            })
                          }
                        >
                          <ButtonContent iconLeft={IconCheck}>
                            Send quote
                          </ButtonContent>
                        </Button>
                        {/*
                          Unavailable until the note exists. The note is the
                          entire content of this action — without it the
                          member is told their request is wrong and not told
                          why.
                        */}
                        <Button
                          size="sm"
                          variant="outline"
                          isDisabled={isPending || !form.notes.trim()}
                          onClick={() =>
                            decide({
                              requestId: request.id,
                              outcome: 'request_revisions',
                              adminNotes: form.notes || undefined,
                            })
                          }
                        >
                          <ButtonContent>Ask for revisions</ButtonContent>
                        </Button>
                        {/*
                          Quiet, and pushed right. Cancelling ends the request
                          outright and is the rarest of the three answers, but
                          it was the loudest thing on the card.
                        */}
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            decide({
                              requestId: request.id,
                              outcome: 'cancel',
                              adminNotes: form.notes || undefined,
                            })
                          }
                          className="text-text-muted ml-auto inline-flex items-center gap-1 rounded px-2 py-1.5 text-xs font-medium transition-colors hover:text-red-700 disabled:opacity-40"
                        >
                          <Icon icon={IconX} size="xs" />
                          Cancel request
                        </button>
                      </div>
                    </>
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

export default CellarReleasesPage;
