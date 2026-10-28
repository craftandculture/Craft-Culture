'use client';

import {
  IconArrowBackUp,
  IconCheck,
  IconMinus,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import { format } from 'date-fns';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import AdminPageHeader from '@/app/_admin/components/AdminPageHeader';
import ConfirmAction from '@/app/_cellar/components/ConfirmAction';
import describePreferredDelivery from '@/app/_cellar/utils/describePreferredDelivery';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import displayWineName from '@/app/_wms/utils/displayWineName';
import OrderChain from '@/app/_zohoSalesOrders/components/OrderChain';
import useTRPC from '@/lib/trpc/browser';
import type { AppRouter } from '@/trpc-router';

type Release =
  inferRouterOutputs<AppRouter>['cellar']['admin']['getReleases']['requests'][number];

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

/* The rate card's figures for the list as it now stands. */
/** A typed amount: 0 when blank, undefined when it is not a valid figure */
const moneyOf = (text: string | number | null | undefined) => {
  const trimmed = String(text ?? '').trim();
  if (trimmed === '') return 0;
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
};

const formFromRequest = (request: Release) => ({
  clearance: request.suggested?.priced
    ? String(request.suggested.clearanceTotalUsd)
    : '',
  delivery: request.suggested?.priced
    ? String(request.suggested.deliveryUsd)
    : '',
  service: request.suggested?.priced
    ? String(request.suggested.serviceFeeUsd)
    : '',
  /*
    Repack is billed on the member's monthly warehouse invoice, per package
    built, and is never part of a delivery quote. The field stays so a
    quote's figures keep their shape; it is always empty.
  */
  repack: '',
  extra: '',
  extraLabel: '',
  goods: request.suggested?.priced
    ? String(request.suggested.goodsValueUsd)
    : '',
  rateVersion: request.suggested?.version ?? '',
  notes: '',
});

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
  /* Opened from a link: load its figures once its row arrives. */
  const [seedFromLink, setSeedFromLink] = useState(false);

  /* Arrived from a PCO's "From cellar release" link: show that request open. */
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('open');
    if (!id) return;
    setStatus('all');
    setOpenId(id);
    setSeedFromLink(true);
  }, []);
  const [form, setForm] = useState({
    clearance: '',
    delivery: '',
    service: '',
    repack: '',
    extra: '',
    extraLabel: '',
    goods: '',
    rateVersion: '',
    notes: '',
  });
  /* Set the moment an operator types, so a refetch cannot undo their edit. */
  const [isOverridden, setIsOverridden] = useState(false);
  /*
    Bottles per line while the wines are being edited, null otherwise. A line
    set to 0 is marked for removal rather than dropped, so it can be put back.
  */
  const [editLines, setEditLines] = useState<Record<string, number> | null>(
    null,
  );
  /* The Zoho order already raised for a release agreed outside the Index. */
  const [salesOrderNumber, setSalesOrderNumber] = useState('');
  /* The order now carrying a confirmed release whose own order was deleted. */
  const [linkOrderNumber, setLinkOrderNumber] = useState('');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    ...api.cellar.admin.getReleases.queryOptions({ status }),
  });

  /* A linked request has no row click to load its figures; without this it quotes $0. */
  useEffect(() => {
    if (!seedFromLink || !openId || !data) return;
    const request = data.requests.find((row) => row.id === openId);
    if (!request) return;
    setSeedFromLink(false);
    setIsOverridden(false);
    setForm(formFromRequest(request));
  }, [seedFromLink, openId, data]);

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

  const { mutate: amendItems, isPending: isAmending } = useMutation(
    api.cellar.admin.amendReleaseItems.mutationOptions({
      onSuccess: async (result, variables) => {
        toast.success(
          result.removed === 0 && result.changed === 0
            ? 'Nothing changed'
            : `Wines updated${result.removed ? ` · ${result.removed} removed` : ''}`,
        );
        setEditLines(null);

        /*
          The rate card's figures were for the old list. Re-read them so the
          quote about to be sent covers the wine actually going out, keeping
          anything the operator typed that is not a rate-card figure.
        */
        const { data: fresh } = await refetch();
        const updated = fresh?.requests.find(
          (row) => row.id === variables.requestId,
        );

        if (updated) {
          setIsOverridden(false);
          setForm((current) => ({
            ...formFromRequest(updated),
            extra: current.extra,
            extraLabel: current.extraLabel,
            notes: current.notes,
          }));
        }
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const { mutate: confirmForMember, isPending: isConfirming } = useMutation(
    api.cellar.admin.confirmRelease.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          result.salesOrderNumber
            ? `Confirmed — ${result.orderNumber} linked to ${result.salesOrderNumber}`
            : `Confirmed — ${result.orderNumber} raised`,
        );
        setSalesOrderNumber('');
        setOpenId(null);
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const { mutate: linkOrder, isPending: isLinking } = useMutation(
    api.cellar.admin.linkReleaseOrder.mutationOptions({
      onSuccess: (result) => {
        toast.success(`Linked to ${result.orderNumber}`);
        setLinkOrderNumber('');
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
      <AdminPageHeader
        title="Cellar releases"
        description="Member requests to release wine held in bond"
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
                ? 'bg-text-primary text-text-on-brand'
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
          /* Before the member has accepted; after that it is an order. */
          const canEditWines = [
            'submitted',
            'under_review',
            'revision_requested',
          ].includes(request.status);
          const isEditing = isOpen && editLines !== null;
          const editedLines = request.items.map((item) => ({
            itemId: item.id,
            bottles: editLines?.[item.id] ?? item.bottles,
          }));
          const keptLines = editedLines.filter((line) => line.bottles > 0);
          const hasWineChanges = editedLines.some(
            (line, index) => line.bottles !== request.items[index]?.bottles,
          );
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
                    setEditLines(null);
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
                  setEditLines(null);
                  setForm(formFromRequest(request));
                }}
                className="hover:bg-fill-muted/40 flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <Typography variant="bodySm" className="font-semibold">
                    {request.partnerName ?? 'Unknown member'}
                    <span className="text-text-muted ml-2 font-mono text-xs">
                      {request.requestNumber}
                      {request.orderNumber ? ` · ${request.orderNumber}` : ''}
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
                  {(request.delivery?.isGift ||
                    describePreferredDelivery(
                      request.delivery?.preferredDate,
                      request.delivery?.preferredWindow,
                    )) && (
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {request.delivery?.isGift && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                          Gift · ID check on delivery
                        </span>
                      )}
                      {describePreferredDelivery(
                        request.delivery?.preferredDate,
                        request.delivery?.preferredWindow,
                      ) && (
                        <span className="bg-fill-muted text-text-muted rounded-full px-2 py-0.5 text-[11px] font-semibold">
                          Prefers{' '}
                          {describePreferredDelivery(
                            request.delivery?.preferredDate,
                            request.delivery?.preferredWindow,
                          )}
                        </span>
                      )}
                    </span>
                  )}
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
                  {canEditWines && (
                    <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
                      {isEditing ? (
                        <>
                          {request.status === 'under_review' &&
                            hasWineChanges && (
                              <Typography
                                variant="bodyXs"
                                colorRole="muted"
                                className="mr-auto"
                              >
                                Saving withdraws the quote already sent; the
                                request returns to awaiting review.
                              </Typography>
                            )}
                          <button
                            type="button"
                            disabled={isAmending}
                            onClick={() => setEditLines(null)}
                            className="text-text-muted hover:text-text-primary rounded px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-40"
                          >
                            Discard
                          </button>
                          <Button
                            size="sm"
                            isDisabled={
                              isAmending ||
                              !hasWineChanges ||
                              keptLines.length === 0
                            }
                            onClick={() =>
                              amendItems({
                                requestId: request.id,
                                lines: keptLines,
                              })
                            }
                          >
                            <ButtonContent iconLeft={IconCheck}>
                              Save wines
                            </ButtonContent>
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditLines({})}
                        >
                          <ButtonContent iconLeft={IconPencil}>
                            Edit wines
                          </ButtonContent>
                        </Button>
                      )}
                    </div>
                  )}

                  <div className="border-border-muted bg-background-primary mb-4 overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-text-muted border-border-muted border-b text-[11px] uppercase tracking-wider">
                          {/*
                            A width, not just a truncate. max-w-0 with nothing
                            to size against collapsed the column to almost
                            nothing and cut every name to two words.
                          */}
                          <th className="w-[55%] px-3 py-1.5 text-left">
                            Wine
                          </th>
                          <th className="px-3 py-1.5 text-center">Vintage</th>
                          <th className="px-3 py-1.5 text-center">Format</th>
                          <th className="px-3 py-1.5 text-left">Lot</th>
                          <th className="px-3 py-1.5 text-right">Quantity</th>
                          {isEditing && <th className="w-10 px-2 py-1.5" />}
                        </tr>
                      </thead>
                      <tbody className="divide-border-muted/60 divide-y">
                        {request.items.map((item) => {
                          const bottlesNow =
                            editLines?.[item.id] ?? item.bottles;
                          const isRemoved = isEditing && bottlesNow === 0;
                          const setBottles = (next: number) =>
                            setEditLines((current) => ({
                              ...current,
                              [item.id]: Math.max(0, next),
                            }));

                          return (
                            <tr
                              key={item.id}
                              className={isRemoved ? 'opacity-40' : undefined}
                            >
                              {/*
                              The stored name ends in its own vintage, size and
                              strength, and this table has columns for two of
                              them — so every row read the vintage twice and
                              carried an abv nobody is deciding on.
                            */}
                              <td className="w-[55%] max-w-0 px-3 py-2">
                                <span
                                  className={`block truncate ${isRemoved ? 'line-through' : ''}`}
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
                              {/*
                              Counted in bottles while editing. A case is just
                              its bottles here, and adding one to a six is
                              the member's seventh bottle, not a second case.
                            */}
                              <td className="px-3 py-2 text-right font-semibold tabular-nums">
                                {isEditing && !isRemoved ? (
                                  <span className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      aria-label="One bottle fewer"
                                      disabled={bottlesNow <= 1}
                                      onClick={() => setBottles(bottlesNow - 1)}
                                      className="border-border-muted hover:bg-fill-muted rounded border p-1 disabled:opacity-30"
                                    >
                                      <Icon icon={IconMinus} size="xs" />
                                    </button>
                                    <span className="min-w-[3.5rem] text-center">
                                      {bottlesNow} btl
                                    </span>
                                    <button
                                      type="button"
                                      aria-label="One bottle more"
                                      onClick={() => setBottles(bottlesNow + 1)}
                                      className="border-border-muted hover:bg-fill-muted rounded border p-1"
                                    >
                                      <Icon icon={IconPlus} size="xs" />
                                    </button>
                                  </span>
                                ) : item.caseConfig &&
                                  item.caseConfig > 1 &&
                                  bottlesNow % item.caseConfig === 0 &&
                                  bottlesNow > 0 ? (
                                  `${bottlesNow / item.caseConfig} × ${item.caseConfig}`
                                ) : (
                                  `${bottlesNow} btl`
                                )}
                              </td>
                              {isEditing && (
                                <td className="px-2 py-2 text-right">
                                  {isRemoved ? (
                                    <button
                                      type="button"
                                      aria-label="Put this wine back"
                                      title="Put back"
                                      onClick={() => setBottles(item.bottles)}
                                      className="text-text-muted hover:text-text-primary rounded p-1"
                                    >
                                      <Icon icon={IconArrowBackUp} size="xs" />
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      aria-label="Remove this wine"
                                      title="Remove"
                                      onClick={() => setBottles(0)}
                                      className="text-text-muted rounded p-1 hover:text-red-700"
                                    >
                                      <Icon icon={IconTrash} size="xs" />
                                    </button>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {request.deliveryAddress && (
                    <div className="mb-3">
                      <Typography variant="bodyXs" colorRole="muted">
                        Deliver to
                        {request.delivery?.addressLabel
                          ? ` · ${request.delivery.addressLabel}`
                          : ''}
                      </Typography>
                      <Typography variant="bodySm">
                        {request.deliveryAddress}
                      </Typography>
                      {request.delivery?.deliveryInstructions && (
                        <Typography
                          variant="bodyXs"
                          colorRole="muted"
                          className="block"
                        >
                          Access: {request.delivery.deliveryInstructions}
                        </Typography>
                      )}
                    </div>
                  )}

                  {/*
                    A gift goes to someone we have never met, so the age and ID
                    check is spelled out here as well as on the order.
                  */}
                  {request.delivery?.isGift && (
                    <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 dark:border-amber-900 dark:bg-amber-500/10">
                      <Typography variant="bodyXs" className="font-semibold">
                        Gift for {request.delivery.recipientName ?? '—'}
                        {request.delivery.recipientPhone
                          ? ` · ${request.delivery.recipientPhone}`
                          : ''}
                      </Typography>
                      {request.delivery.giftMessage && (
                        <Typography variant="bodyXs" className="mt-0.5 block">
                          Message: &ldquo;{request.delivery.giftMessage}&rdquo;
                        </Typography>
                      )}
                      <Typography
                        variant="bodyXs"
                        colorRole="muted"
                        className="mt-0.5 block"
                      >
                        Recipient must be 21 or over; check ID on delivery. The
                        order carries their name and mobile.
                      </Typography>
                    </div>
                  )}

                  {describePreferredDelivery(
                    request.delivery?.preferredDate,
                    request.delivery?.preferredWindow,
                  ) && (
                    <div className="mb-3">
                      <Typography variant="bodyXs" colorRole="muted">
                        Preferred delivery (not yet confirmed)
                      </Typography>
                      <Typography variant="bodySm">
                        {describePreferredDelivery(
                          request.delivery?.preferredDate,
                          request.delivery?.preferredWindow,
                        )}
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
                      Confirmed on{' '}
                      {request.confirmedAt
                        ? format(new Date(request.confirmedAt), 'd MMMM yyyy')
                        : '—'}{' '}
                      · total ${request.totalCostUsd?.toLocaleString() ?? 0}
                      {request.privateClientOrderId && request.orderNumber && (
                        <>
                          {' · '}
                          <Link
                            href={`/platform/admin/private-orders/${request.privateClientOrderId}`}
                            className="text-text-primary font-mono font-semibold underline underline-offset-2"
                          >
                            {request.orderNumber}
                          </Link>
                          {request.zohoSalesOrderNumber
                            ? ` · ${request.zohoSalesOrderNumber}`
                            : ''}
                        </>
                      )}
                    </Typography>
                  ) : null}
                  {request.status === 'confirmed' && !request.orderNumber && (
                    <div className="border-border-muted bg-fill-muted/40 mt-3 rounded-lg border p-3">
                      <Typography variant="bodySm" className="mb-1 font-medium">
                        Its order is missing
                      </Typography>
                      <Typography variant="bodyXs" colorRole="muted" className="mb-2">
                        The order raised for this release was deleted, so the
                        warehouse cannot pick the member&apos;s bottles for
                        it. Enter the order now carrying this delivery to link
                        it. Its prices are not changed.
                      </Typography>
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          value={linkOrderNumber}
                          onChange={(event) => setLinkOrderNumber(event.target.value)}
                          placeholder="PCO-2026-00104"
                          className="max-w-[200px]"
                        />
                        <ConfirmAction
                          title={`Link ${request.requestNumber} to ${linkOrderNumber.trim().toUpperCase() || 'this order'}?`}
                          description={
                            <p>
                              The order is marked as the member&apos;s own
                              delivery, so their held bottles can be picked for
                              it.
                            </p>
                          }
                          confirmLabel="Link order"
                          onConfirm={() =>
                            linkOrder({
                              requestId: request.id,
                              orderNumber: linkOrderNumber.trim(),
                            })
                          }
                        >
                          <Button
                            size="sm"
                            variant="outline"
                            isDisabled={isLinking || !linkOrderNumber.trim()}
                          >
                            <ButtonContent iconLeft={IconCheck}>Link order</ButtonContent>
                          </Button>
                        </ConfirmAction>
                      </div>
                    </div>
                  )}
                  {request.status === 'confirmed' && (
                    <div className="mt-2">
                      <OrderChain releaseId={request.id} />
                    </div>
                  )}
                  {request.status === 'confirmed' ? null : (
                    <>
                      {/*
                        Members often agree on WhatsApp and the Zoho order is
                        raised there and then. Once it is picked their Accept
                        has nothing left to take, so staff confirm it here and
                        link the order that already carries the wine.
                      */}
                      {request.status === 'under_review' &&
                        request.quotedAt && (
                          <div className="border-border-muted bg-fill-muted/40 mb-4 rounded-lg border p-3">
                            <Typography
                              variant="bodySm"
                              className="mb-1 font-medium"
                            >
                              Agreed outside the Index?
                            </Typography>
                            <Typography
                              variant="bodyXs"
                              colorRole="muted"
                              className="mb-2"
                            >
                              Confirm it for the member at the quoted $
                              {request.totalCostUsd?.toLocaleString() ?? 0}. If
                              the Zoho order is already raised, enter its number
                              so the order links to it instead of being sent to
                              Zoho again.
                            </Typography>
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                value={salesOrderNumber}
                                onChange={(event) =>
                                  setSalesOrderNumber(event.target.value)
                                }
                                placeholder="SO-00225 (optional)"
                                className="max-w-[200px]"
                              />
                              <ConfirmAction
                                title={`Confirm ${request.requestNumber} for the member?`}
                                description={
                                  <p>
                                    The release is confirmed at $
                                    {request.totalCostUsd?.toLocaleString() ??
                                      0}
                                    {salesOrderNumber.trim()
                                      ? ` and linked to ${salesOrderNumber.trim().toUpperCase()}.`
                                      : ' and a new order is raised for the team to send to Zoho.'}
                                  </p>
                                }
                                confirmLabel="Confirm for member"
                                onConfirm={() =>
                                  confirmForMember({
                                    requestId: request.id,
                                    salesOrderNumber:
                                      salesOrderNumber.trim() || undefined,
                                  })
                                }
                              >
                                <Button
                                  size="sm"
                                  variant="outline"
                                  isDisabled={isConfirming || isEditing}
                                >
                                  <ButtonContent iconLeft={IconCheck}>
                                    Confirm for member
                                  </ButtonContent>
                                </Button>
                              </ConfirmAction>
                            </div>
                          </div>
                        )}

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
                              {isOverridden ? 'Overridden' : 'Member rate card'}{' '}
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
                                className="text-text-primary text-xs font-medium hover:underline"
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

                      {/*
                        A list with the figures in one column, not a grid of
                        cells. Eight numbers in a run-on sentence could not be
                        read at all; eight numbers in a grid still cannot be
                        compared, because each one starts wherever its label
                        ended. Stacked and right-aligned, they line up on the
                        decimal and the eye can add them.

                        Goods value sits apart above the rule: it is what the
                        percentages are taken on, not a charge.
                      */}
                      {request.suggested?.priced && (
                        <div className="border-border-muted bg-background-primary mb-3 overflow-hidden rounded-lg border">
                          <div className="border-border-muted flex items-baseline justify-between gap-3 border-b px-4 py-2">
                            <Typography
                              variant="bodyXs"
                              colorRole="muted"
                              className="uppercase tracking-[0.08em]"
                            >
                              Goods value &middot; declared on import
                            </Typography>
                            <Typography
                              variant="bodySm"
                              className="tabular-nums"
                            >
                              {request.suggested.goodsValueUsd.toFixed(2)}
                            </Typography>
                          </div>

                          <dl className="grid gap-x-8 gap-y-1 px-4 py-2.5 sm:grid-cols-2">
                            {[
                              {
                                label: 'Duty',
                                note: 'on the declared value',
                                value: request.suggested.dutyUsd,
                              },
                              {
                                label: 'VAT',
                                note: 'on everything else',
                                value: request.suggested.vatUsd,
                              },
                              {
                                label: 'Transfer',
                                note: 'out of the free zone',
                                value: request.suggested.transferUsd,
                              },
                              {
                                label: 'Distributor',
                                note: 'licensed delivery',
                                value: request.suggested.distributorMarginUsd,
                              },
                              {
                                label: 'Delivery',
                                note: 'the drive',
                                value: request.suggested.deliveryUsd,
                              },
                            ].map((line) => (
                              <div
                                key={line.label}
                                className="flex items-baseline justify-between gap-3"
                              >
                                <dt
                                  className="text-text-muted text-xs"
                                >
                                  {line.label}
                                  <span className="text-text-muted/70 ml-1.5 text-[11px]">
                                    {line.note}
                                  </span>
                                </dt>
                                <dd
                                  className="text-text-primary m-0 text-xs tabular-nums"
                                >
                                  {line.value.toFixed(2)}
                                </dd>
                              </div>
                            ))}
                          </dl>

                          

                          <div className="border-border-muted bg-fill-muted/40 flex items-baseline justify-between gap-3 border-t px-4 py-2">
                            <Typography
                              variant="bodyXs"
                              className="text-text-primary font-semibold uppercase tracking-[0.08em]"
                            >
                              Craft &amp; Culture earns
                            </Typography>
                            <Typography
                              variant="bodySm"
                              className="text-text-primary font-semibold tabular-nums"
                            >
                              {request.suggested.ccMarginUsd.toFixed(2)}
                            </Typography>
                          </div>
                        </div>
                      )}

                      <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {[
                          {
                            key: 'clearance',
                            label: 'Duty, VAT & clearance $',
                          },
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
                                if (
                                  field.key !== 'extra' &&
                                  field.key !== 'extraLabel'
                                ) {
                                  setIsOverridden(true);
                                }

                                setForm((current) => ({
                                  ...current,
                                  [field.key]: event.target.value,
                                }));
                              }}
                              placeholder={field.placeholder ?? '0.00'}
                            />
                          </label>
                        ))}
                      </div>

                      {/*
                        What the member will actually be charged, from the
                        fields as typed rather than from the card. Four inputs
                        and a Send button with no total meant the figure being
                        committed to existed only in the operator's head, and
                        an override typed into one box changed a number nobody
                        saw until it reached the member.
                      */}
                      <div className="border-border-muted bg-fill-muted/40 mb-3 flex flex-wrap items-baseline justify-between gap-2 rounded-lg border px-4 py-2.5">
                        <div className="min-w-0">
                          <Typography
                            variant="bodyXs"
                            colorRole="muted"
                            className="uppercase tracking-[0.08em]"
                          >
                            Quote to the member
                          </Typography>
                          <Typography
                            variant="bodyXs"
                            colorRole="muted"
                            className="block"
                          >
                            Clearance, delivery, our fee
                            {Number(form.extra) ? ' and the extra' : ''}
                          </Typography>
                        </div>
                        <Typography
                          variant="headingSm"
                          className="text-text-primary tabular-nums"
                        >
                          $
                          {(
                            (Number(form.clearance) || 0) +
                            (Number(form.delivery) || 0) +
                            (Number(form.service) || 0) +
                            (Number(form.extra) || 0)
                          ).toFixed(2)}
                        </Typography>
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
                        <ConfirmAction
                          title={`Send the quote for ${request.requestNumber}?`}
                          description={
                            <p>
                              The member is told it comes to $
                              {(
                                (Number(form.clearance) || 0) +
                                (Number(form.delivery) || 0) +
                                (Number(form.service) || 0) +
                                (Number(form.extra) || 0)
                              ).toLocaleString('en-US', {
                                maximumFractionDigits: 0,
                              })}
                              , all in, and can accept it straight away.
                            </p>
                          }
                          confirmLabel="Send quote"
                          onConfirm={() => {
                            /*
                              A figure that is not a number is refused, not
                              sent as $0. A typo in the delivery cost used to
                              quote the member nothing for delivery.
                            */
                            const figures = {
                              clearance: moneyOf(form.clearance),
                              delivery: moneyOf(form.delivery),
                              service: moneyOf(form.service),
                              extra: moneyOf(form.extra),
                              goods: moneyOf(form.goods),
                            };
                            const bad = Object.entries(figures).find(
                              ([, value]) => value === undefined,
                            );
                            if (bad) {
                              toast.error(
                                `The ${bad[0]} figure is not a valid amount. Enter a number, or leave it blank for none.`,
                              );
                              return;
                            }

                            decide({
                              requestId: request.id,
                              outcome: 'quote',
                              clearanceCostUsd: figures.clearance!,
                              deliveryCostUsd: figures.delivery!,
                              serviceFeeUsd: figures.service!,
                              additionalChargeUsd: figures.extra!,
                              additionalChargeLabel:
                                form.extraLabel || undefined,
                              goodsValueUsd: figures.goods!,
                              clearanceRateVersion:
                                form.rateVersion || undefined,
                              adminNotes: form.notes || undefined,
                            });
                          }}
                        >
                          {/*
                            Not while the wines are being edited. The figures
                            above are for the list before the edit.
                          */}
                          <Button size="sm" isDisabled={isPending || isEditing}>
                            <ButtonContent iconLeft={IconCheck}>
                              Send quote
                            </ButtonContent>
                          </Button>
                        </ConfirmAction>
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
                        <ConfirmAction
                          title={`Cancel ${request.requestNumber}?`}
                          description={
                            <p>
                              The request is closed and the member is told it
                              has been cancelled. This cannot be undone.
                            </p>
                          }
                          confirmLabel="Cancel request"
                          onConfirm={() =>
                            decide({
                              requestId: request.id,
                              outcome: 'cancel',
                              adminNotes: form.notes || undefined,
                            })
                          }
                        >
                          <button
                            type="button"
                            disabled={isPending}
                            className="text-text-muted ml-auto inline-flex items-center gap-1 rounded px-2 py-1.5 text-xs font-medium transition-colors hover:text-red-700 disabled:opacity-40"
                          >
                            <Icon icon={IconX} size="xs" />
                            Cancel request
                          </button>
                        </ConfirmAction>
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
