'use client';

import {
  IconBottle,
  IconBuildingWarehouse,
  IconChevronDown,
  IconCoin,
  IconDownload,
  IconHistory,
  IconInfoCircle,
  IconRefresh,
  IconSearch,
  IconShip,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import Link from 'next/link';
import { Fragment, useMemo, useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Tooltip from '@/app/_ui/components/Tooltip/Tooltip';
import TooltipContent from '@/app/_ui/components/Tooltip/TooltipContent';
import TooltipTrigger from '@/app/_ui/components/Tooltip/TooltipTrigger';
import Typography from '@/app/_ui/components/Typography/Typography';
import MovementTypeBadge from '@/app/_wms/components/MovementTypeBadge';
import type { MovementTypeBadgeProps } from '@/app/_wms/components/MovementTypeBadge';
import useTRPC from '@/lib/trpc/browser';

interface CellarParcel {
  stockId: string;
  locationId: string;
  quantityCases: number;
  reservedCases: number;
  lotNumber: string | null;
  receivedAt: Date | null;
}

interface CellarWine {
  lwin18: string;
  productName: string;
  producer: string | null;
  vintage: number | null;
  bottleSize: string | null;
  caseConfig: number | null;
  totalCases: number;
  reservedCases: number;
  costPerBottle: number | null;
  locations: CellarParcel[];
}

type QuickFilter = 'all' | 'largeFormat' | 'magnumPlus' | 'reserved';

const bottlesOf = (wine: { totalCases: number; caseConfig: number | null }) =>
  wine.totalCases * (wine.caseConfig ?? 1);

const sizeMl = (size: string | null) => {
  if (!size) return 750;

  const value = Number(size.replace(/[^\d.]/g, ''));

  if (!value) return 750;

  return size.toLowerCase().includes('cl') ? value * 10 : value;
};

type Currency = 'USD' | 'AED';

/*
  The dirham is pegged to the dollar at 3.6725, so this is a conversion rather
  than a rate that has to be fetched and can go stale. Everything on this page
  is held in dollars; the toggle only changes how it is read.
*/
const AED_PER_USD = 3.6725;

const formatMoney = (
  value: number,
  currency: Currency,
  precise = false,
) =>
  (currency === 'AED' ? value * AED_PER_USD : value).toLocaleString('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: precise ? 2 : 0,
  });

/**
 * A collector's cellar
 *
 * Built in the Stock Explorer idiom — dense, tabular, expandable — because
 * that layout works and a collection is still inventory. What changes is what
 * it reports: bottles rather than cases, no LWINs, no bay codes, no owner
 * column, and cost stated as what was declared on import rather than dressed
 * up as a valuation.
 */
const CellarPage = () => {
  const api = useTRPC();
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [openWine, setOpenWine] = useState<string | null>(null);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    ...api.wms.partner.getStock.queryOptions(),
  });

  /* What the member has picked, in bottles, keyed by the parcel it comes from. */
  const [basket, setBasket] = useState<Map<string, number>>(new Map());

  const [currency, setCurrency] = useState<Currency>('USD');

  const money = (value: number, precise = false) =>
    formatMoney(value, currency, precise);

  /*
    Every quantity control routes through here, so the cap on what is held is
    applied in one place. Spread across the stepper, the case button and the
    typed input it would have been three chances to let somebody request wine
    they do not own.
  */
  const setParcelBottles = (stockId: string, bottles: number, held: number) =>
    setBasket((current) => {
      const next = new Map(current);
      const wanted = Math.max(0, Math.min(held, bottles));

      if (wanted > 0) next.set(stockId, wanted);
      else next.delete(stockId);

      return next;
    });
  const [address, setAddress] = useState('');
  const [memberNotes, setMemberNotes] = useState('');
  /* Set only when the member chooses to send this one somewhere else. */
  const [isBasketOpen, setIsBasketOpen] = useState(false);
  /* Which submitted request is open, and the edits made to it so far. */
  const [openRequestId, setOpenRequestId] = useState<string | null>(null);
  const [editLines, setEditLines] = useState<Map<string, number>>(new Map());
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [shouldSaveAddress, setShouldSaveAddress] = useState(true);

  const { data: profile, refetch: refetchProfile } = useQuery({
    ...api.cellar.member.getProfile.queryOptions(),
  });

  const savedAddress = profile?.deliveryAddress ?? null;

  /*
    The address the request will actually carry. A member who has not opened
    the editor is delivering to their account address, so that is what gets
    sent — not the empty box behind it.
  */
  const effectiveAddress = isEditingAddress ? address.trim() : (savedAddress ?? '');

  const { mutate: saveAddress } = useMutation(
    api.cellar.member.saveDeliveryAddress.mutationOptions({
      onSuccess: () => void refetchProfile(),
      onError: (error) => toast.error(error.message),
    }),
  );

  const { data: releaseData, refetch: refetchReleases } = useQuery({
    ...api.cellar.member.getReleases.queryOptions(),
  });

  const { mutate: submitRelease } = useMutation(
    api.cellar.member.submitRelease.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          `${result.requestNumber} submitted. We will confirm the cost of clearance and delivery.`,
        );
        setBasket(new Map());
        setAddress('');
        setMemberNotes('');
        setIsEditingAddress(false);
        void refetchReleases();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const { mutate: saveRelease, isPending: isSaving } = useMutation(
    api.cellar.member.saveRelease.mutationOptions({
      onSuccess: (result) => {
        /*
          Already with us: the wine has joined that request and the team has
          been told. Submitting again would be refused, and rightly — it is
          the same request, not a new one.
        */
        if (result.alreadySubmitted) {
          toast.success(
            `Added to ${result.requestNumber}. We will confirm the cost for the full request.`,
          );
          setBasket(new Map());
          setMemberNotes('');
          setIsBasketOpen(false);
          void refetchReleases();
          return;
        }

        submitRelease({ requestId: result.requestId });
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const { mutate: amendRelease, isPending: isAmending } = useMutation(
    api.cellar.member.amendRelease.mutationOptions({
      onSuccess: (result) => {
        toast.success(`${result.requestNumber} updated.`);
        setOpenRequestId(null);
        void refetchReleases();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const { mutate: withdrawRelease, isPending: isWithdrawing } = useMutation(
    api.cellar.member.withdrawRelease.mutationOptions({
      onSuccess: (result) => {
        toast.success(`${result.requestNumber} withdrawn.`);
        setOpenRequestId(null);
        void refetchReleases();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const { mutate: acceptRelease, isPending: isAccepting } = useMutation(
    api.cellar.member.acceptRelease.mutationOptions({
      onSuccess: (result) => {
        toast.success(`Accepted. Order ${result.orderNumber} has been raised.`);
        void refetchReleases();
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const { mutate: requestReport, isPending: isRequesting } = useMutation(
    api.wms.partner.requestConditionReport.mutationOptions({
      onSuccess: (result) => {
        void refetch();
        toast.success(
          `Condition report ${result.requestNumber} requested — ${result.cases} ${
            result.cases === 1 ? 'case' : 'cases'
          }, AED ${result.feeAed.toLocaleString()}.`,
        );
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const wines = useMemo(
    () => (data?.products ?? []) as unknown as CellarWine[],
    [data],
  );

  /*
    A wine can sit in more than one parcel. Adding "a case" should not make the
    member choose which one — fill the earliest parcel that has room and carry
    the remainder into the next, which is what the warehouse would do anyway.
  */
  const addToWine = (wine: CellarWine, bottles: number) => {
    setBasket((current) => {
      const next = new Map(current);
      let remaining = bottles;

      /*
        Taking bottles away walks the parcels backwards, so removing one
        undoes the last one added rather than breaking into the earliest
        parcel the member had already settled on.
      */
      const parcels =
        bottles < 0 ? [...wine.locations].reverse() : wine.locations;

      for (const parcel of parcels) {
        if (remaining === 0) break;

        const held = parcel.quantityCases * (wine.caseConfig ?? 1);
        const already = next.get(parcel.stockId) ?? 0;

        if (bottles > 0) {
          const room = held - already;
          if (room <= 0) continue;

          const take = Math.min(room, remaining);
          next.set(parcel.stockId, already + take);
          remaining -= take;
        } else {
          if (already <= 0) continue;

          const give = Math.min(already, -remaining);
          const left = already - give;

          if (left > 0) next.set(parcel.stockId, left);
          else next.delete(parcel.stockId);

          remaining += give;
        }
      }

      return next;
    });
  };

  const basketBottlesOf = (wine: CellarWine) =>
    wine.locations.reduce(
      (sum, parcel) => sum + (basket.get(parcel.stockId) ?? 0),
      0,
    );

  const clearWine = (wine: CellarWine) =>
    setBasket((current) => {
      const next = new Map(current);
      for (const parcel of wine.locations) next.delete(parcel.stockId);
      return next;
    });

  /* Basket lines are keyed by parcel; the request panel names wines. */
  const parcelIndex = useMemo(() => {
    const index = new Map<string, CellarWine>();

    for (const wine of wines) {
      for (const parcel of wine.locations) index.set(parcel.stockId, wine);
    }

    return index;
  }, [wines]);

  /*
    A member who asked for a whole case should be told they asked for a case.
    "6 bottles" and "1 case of 6" are the same number and a different
    instruction — the second one gets a sealed case picked, which is what they
    meant and what protects the wine.
  */
  const describeQuantity = (bottles: number, caseConfig: number | null) => {
    const pack = caseConfig ?? 1;

    if (pack > 1 && bottles % pack === 0) {
      const cases = bottles / pack;

      return `${cases} ${cases === 1 ? 'case' : 'cases'} of ${pack} · ${bottles} bottles`;
    }

    return `${bottles} ${bottles === 1 ? 'bottle' : 'bottles'}`;
  };

  /*
    An estimate against the member's own rate card, so the shape of the cost
    is visible before they commit to asking. Asking and waiting a day to learn
    the number is how somebody submits a request they would never have made.
  */
  const estimateLines = [...basket.entries()].map(([stockId, bottles]) => ({
    stockId,
    bottles,
  }));

  const { data: estimate, isFetching: isEstimating } = useQuery({
    ...api.cellar.member.estimateRelease.queryOptions({
      lines: estimateLines,
    }),
    enabled: estimateLines.length > 0,
    placeholderData: (previous) => previous,
  });

  const openRequests = (releaseData?.requests ?? []).filter((request) =>
    ['submitted', 'under_review', 'revision_requested'].includes(
      request.status,
    ),
  );

  /*
    A request we have already quoted is deliberately not a merge target: the
    member is holding a figure, and adding to what it covers would make that
    figure wrong.
  */
  const mergeTarget = openRequests.find(
    (request) => request.status !== 'under_review',
  );

  const basketLines = [...basket.entries()]
    .map(([stockId, bottles]) => ({
      stockId,
      bottles,
      wine: parcelIndex.get(stockId),
    }))
    .filter((line) => line.wine);


  const inbound = useMemo(() => data?.inbound ?? [], [data]);

  const requestByStock = useMemo(() => {
    const map = new Map<string, { requestNumber: string }>();

    for (const request of data?.openRequests ?? []) {
      if (request.stockId) map.set(request.stockId, request);
    }

    return map;
  }, [data]);

  const movementsByWine = useMemo(() => {
    type Movement = NonNullable<typeof data>['recentMovements'][number];

    const map = new Map<string, Movement[]>();

    for (const movement of data?.recentMovements ?? []) {
      if (!movement.lwin18) continue;
      map.set(movement.lwin18, [...(map.get(movement.lwin18) ?? []), movement]);
    }

    return map;
  }, [data]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return wines
      .filter((wine) => {
        if (
          term &&
          ![wine.productName, wine.producer, String(wine.vintage ?? '')]
            .join(' ')
            .toLowerCase()
            .includes(term)
        ) {
          return false;
        }

        if (quickFilter === 'largeFormat') return sizeMl(wine.bottleSize) > 750;
        if (quickFilter === 'magnumPlus') return sizeMl(wine.bottleSize) >= 1500;
        if (quickFilter === 'reserved') return wine.reservedCases > 0;

        return true;
      })
      .sort(
        (a, b) =>
          (a.producer ?? '').localeCompare(b.producer ?? '') ||
          (b.vintage ?? 0) - (a.vintage ?? 0) ||
          a.productName.localeCompare(b.productName),
      );
  }, [wines, search, quickFilter]);

  const totals = useMemo(() => {
    const priced = wines.filter((wine) => (wine.costPerBottle ?? 0) > 0);

    return {
      bottles: wines.reduce((sum, wine) => sum + bottlesOf(wine), 0),
      cases: wines.reduce((sum, wine) => sum + wine.totalCases, 0),
      wines: wines.length,
      producers: new Set(wines.map((wine) => wine.producer?.trim() || 'Other'))
        .size,
      cost: priced.reduce(
        (sum, wine) => sum + bottlesOf(wine) * (wine.costPerBottle ?? 0),
        0,
      ),
      pricedCount: priced.length,
      inboundBottles: inbound.reduce(
        (sum, line) => sum + (line.totalBottles ?? 0),
        0,
      ),
    };
  }, [wines, inbound]);

  const handleExport = () => {
    const csvRows = [
      /*
        The export stays in dollars whatever the screen is showing, and says
        so in the header. A spreadsheet whose currency depends on a toggle
        somebody flicked before downloading it is a spreadsheet nobody can
        trust a month later.
      */
      ['Producer', 'Wine', 'Vintage', 'Size', 'Pack', 'Cases', 'Bottles', 'Import USD/btl'],
      ...wines.map((wine) => [
        wine.producer ?? '',
        wine.productName,
        wine.vintage ?? '',
        wine.bottleSize ?? '',
        wine.caseConfig ?? '',
        wine.totalCases,
        bottlesOf(wine),
        wine.costPerBottle ?? '',
      ]),
    ];

    const csv = csvRows
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','),
      )
      .join('\n');

    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = `cellar-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const filters: { key: QuickFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'largeFormat', label: 'Large format' },
    { key: 'magnumPlus', label: 'Magnum and above' },
    { key: 'reserved', label: 'Allocated' },
  ];

  const th =
    'text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted px-3 py-2';
  /*
    Everything on a row was the same weight, so nothing was findable: the wine
    name competed with its own producer, with six numbers and with two
    buttons. The name is the only thing at full strength now; the rest recedes
    to supporting detail and the numbers carry weight only where a member is
    actually counting — bottles.
  */
  const td = 'px-3 py-2 align-middle text-[13px]';
  const tdMuted = `${td} text-text-muted`;

  /*
    The catalogue name repeats the vintage, size and strength that all have
    their own columns. Trimming the size alone left three formats of one wine
    reading identically, so the vintage goes too — what remains is the wine
    itself, and the columns say which bottle of it.
  */
  const displayName = (name: string) =>
    name
      .replace(/\s+\d+(\.\d+)?%\s*abv\s*$/i, '')
      .replace(/\s+\d+(\.\d+)?L\s*$/i, '')
      .replace(/\s+(19|20)\d{2}\s*$/, '')
      .trim();

  /*
    The table can trim the vintage and format because it has columns for them.
    A list has none, so three vintages of one wine would read as the same
    line. Here the detail goes back on, after the name rather than buried in
    it.
  */
  const lineLabel = (
    name: string,
    vintage: number | null | undefined,
    bottleSize: string | null | undefined,
    caseConfig: number | null | undefined,
  ) => {
    /*
      Pack and format together, the way a merchant writes them: 6×75cl says
      both how it is cased and what the bottle is, and distinguishes a six of
      75cl from a three of magnums at a glance.
    */
    const pack = caseConfig ?? 1;
    const format = bottleSize
      ? pack > 1
        ? `${pack}×${bottleSize}`
        : bottleSize
      : null;

    return [displayName(name), vintage ? String(vintage) : 'NV', format]
      .filter(Boolean)
      .join(' · ');
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 py-6 sm:px-6 sm:py-8">
      <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {/*
            The same programme the member joined, named the same way. A portal
            that calls itself something else reads as a different product from
            the one they were sold.
          */}
          <Typography
            variant="bodyXs"
            className="text-text-brand mb-1.5 block font-semibold uppercase tracking-[0.18em]"
          >
            C&amp;C Private Cellar
          </Typography>
          <Typography variant="headingLg">
            {data?.partner?.name ?? 'Your cellar'}
          </Typography>
          <Typography variant="bodySm" colorRole="muted" className="mt-1 block">
            Held in bond at Craft &amp; Culture, Ras Al Khaimah. Duty is
            suspended until you call wines forward.
          </Typography>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            isDisabled={isRefetching}
          >
            <ButtonContent iconLeft={IconRefresh}>Refresh</ButtonContent>
          </Button>
          {/*
            The dirham is pegged, so this converts rather than quotes a rate.
            A member who thinks in dirhams should not have to do the sum to
            know whether a release is worth asking for.
          */}
          <div className="border-border-muted flex overflow-hidden rounded-lg border">
            {(['USD', 'AED'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setCurrency(option)}
                aria-pressed={currency === option}
                className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  currency === option
                    ? 'bg-fill-brand text-text-on-brand'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            isDisabled={!wines.length}
          >
            <ButtonContent iconLeft={IconDownload}>Export</ButtonContent>
          </Button>
        </div>
      </header>

      {/*
        Four cards in four unrelated pastels said nothing — the colours were
        chosen per card rather than meaning anything, so the eye got no help
        deciding which figure mattered. They are one neutral surface now, and
        the only card that colours itself is wine in transit, which colours
        itself only when there is some.
      */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5">
        {[
          {
            icon: IconBottle,
            value: totals.bottles.toLocaleString(),
            label: 'Bottles',
            detail: `${totals.cases.toLocaleString()} cases`,
            alert: false,
          },
          {
            icon: IconBuildingWarehouse,
            value: totals.wines.toLocaleString(),
            label: 'Wines',
            detail: `${totals.producers} producers`,
            alert: false,
          },
          {
            icon: IconCoin,
            value: totals.cost > 0 ? money(totals.cost) : '—',
            label: 'Recorded on import',
            detail: `${totals.pricedCount}/${totals.wines} wines`,
            alert: false,
          },
          {
            icon: IconShip,
            value: totals.inboundBottles.toLocaleString(),
            label: 'In transit',
            detail: `${inbound.length} ${inbound.length === 1 ? 'line' : 'lines'}`,
            alert: inbound.length > 0,
          },
        ].map((card) => (
          <div
            key={card.label}
            className={`rounded-xl border px-3 py-2.5 text-center ${
              card.alert
                ? 'border-amber-200 bg-amber-50/50'
                : 'border-border-muted bg-background-primary'
            }`}
          >
            <div
              className={`mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-md ${
                card.alert
                  ? 'bg-amber-100 text-amber-600'
                  : 'bg-teal-50 text-teal-600'
              }`}
            >
              <card.icon size={13} />
            </div>
            <div className="text-lg font-bold leading-tight tabular-nums">
              {card.value}
            </div>
            <div className="text-text-muted text-[11px]">{card.label}</div>
            <div className="text-text-muted text-[10px]">{card.detail}</div>
          </div>
        ))}
      </div>

      {inbound.length > 0 && (
        <section className="border-border-muted mb-5 rounded-xl border">
          <div className="border-border-muted flex items-center gap-2 border-b px-3 py-2.5">
            <Icon icon={IconShip} size="sm" className="text-amber-500" />
            <Typography variant="labelSm" className="font-semibold">
              On its way
            </Typography>
          </div>
          <div className="divide-border-muted divide-y">
            {inbound.map((line, index) => (
              <div
                key={`${line.shipmentNumber}-${line.lwin18 ?? index}`}
                className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
              >
                <Typography variant="bodySm" className="min-w-0 break-words">
                  {line.productName}
                </Typography>
                <Typography
                  variant="bodyXs"
                  colorRole="muted"
                  className="flex-shrink-0 tabular-nums"
                >
                  {line.totalBottles ?? 0} btl
                  {line.eta
                    ? ` · due ${format(new Date(line.eta), 'MMM yyyy')}`
                    : ''}
                </Typography>
              </div>
            ))}
          </div>
        </section>
      )}

      {openRequests.length > 0 && (
        <section className="border-border-brand/40 bg-fill-brand/5 mb-5 overflow-hidden rounded-xl border">
          <div className="flex items-center justify-between px-3 py-2">
            <Typography
              variant="bodyXs"
              className="text-text-brand flex items-center gap-1.5 font-semibold uppercase tracking-wider"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500" />
              </span>
              Requests in progress
            </Typography>
            <Typography variant="bodyXs" colorRole="muted">
              {openRequests.length}
            </Typography>
          </div>

          {/*
            A line each, not a card each. Two requests took three hundred
            pixels above the cellar and said almost the same thing twice; the
            one that needs a decision is the only one that earns more room.
          */}
          <div className="divide-border-muted/60 bg-background-primary divide-y">
            {openRequests.map((request) => {
              const needsDecision = request.status === 'under_review';
              /* Sent back to them: nothing happens until they act on it. */
              const needsAction = request.status === 'revision_requested';

              const isEditable = [
                'draft',
                'submitted',
                'revision_requested',
              ].includes(request.status);

              const isOpen = openRequestId === request.id;

              const lineFor = (itemId: string, fallback: number) =>
                editLines.get(itemId) ?? fallback;

              return (
                <div key={request.id}>
                <div
                  className={`flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between ${
                    needsDecision
                      ? 'bg-teal-50/60'
                      : needsAction
                        ? 'bg-amber-50/60'
                        : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (isOpen) {
                        setOpenRequestId(null);
                        return;
                      }

                      setOpenRequestId(request.id);
                      setEditLines(new Map());
                    }}
                    className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-left"
                  >
                    <Icon
                      icon={IconChevronDown}
                      size="xs"
                      className={`text-text-muted transition-transform ${isOpen ? '' : '-rotate-90'}`}
                    />
                    <span className="text-text-muted font-mono text-xs">
                      {request.requestNumber}
                    </span>
                    <Typography variant="bodyXs" colorRole="muted">
                      {request.items.length}{' '}
                      {request.items.length === 1 ? 'wine' : 'wines'}
                    </Typography>

                    {request.status === 'submitted' && (
                      <Typography variant="bodyXs" colorRole="muted">
                        &middot; Under review
                      </Typography>
                    )}

                    {needsAction && (
                      <>
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                          Action needed
                        </span>
                        <Typography variant="bodyXs" className="text-amber-700">
                          {request.adminNotes ??
                            'A change is required before we can price this request'}
                        </Typography>
                      </>
                    )}

                    {needsDecision && (
                      <Typography variant="bodySm" className="font-semibold">
                        &middot; {money(request.totalCostUsd ?? 0)} to deliver,
                        all in
                      </Typography>
                    )}
                  </button>

                  {needsDecision && (
                    <div className="flex flex-shrink-0 items-center gap-1.5">
                      {/*
                        One figure, and the detail behind an ⓘ. An itemised
                        quote invites a line-by-line negotiation of costs the
                        member cannot change, and naming the amounts would
                        publish our rates to anyone who knows what their own
                        wine cost.
                      */}
                      <Tooltip>
                        <TooltipTrigger aria-label="What this figure includes">
                          <Icon
                            icon={IconInfoCircle}
                            size="xs"
                            colorRole="muted"
                          />
                        </TooltipTrigger>
                        <TooltipContent
                          side="left"
                          className="max-w-[240px] text-left lg:max-w-[240px]"
                        >
                          <div className="flex flex-col gap-1.5 text-left">
                            <Typography
                              variant="bodyXs"
                              className="font-semibold"
                            >
                              You already own the wine. This is the cost of
                              releasing it.
                            </Typography>
                            <Typography variant="bodyXs">
                              Duty, VAT, clearance, transfer out of bond,
                              licensed delivery, and our handling.
                              {request.additionalChargeLabel
                                ? ` Also ${request.additionalChargeLabel.toLowerCase()}.`
                                : ''}
                            </Typography>
                            <Typography variant="bodyXs" colorRole="muted">
                              Nothing further is charged.
                            </Typography>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                      <Button
                        size="sm"
                        colorRole="brand"
                        isDisabled={isAccepting}
                        onClick={() => acceptRelease({ requestId: request.id })}
                      >
                        <ButtonContent>Accept and deliver</ButtonContent>
                      </Button>
                    </div>
                  )}
                </div>

                {isOpen && (
                  <div className="border-border-muted bg-background-primary border-t px-3 py-3">
                    {needsAction && request.adminNotes && (
                      <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2">
                        <Typography
                          variant="bodyXs"
                          className="mb-0.5 block font-semibold uppercase tracking-wider text-amber-800"
                        >
                          What we need changed
                        </Typography>
                        <Typography variant="bodySm" className="text-amber-900">
                          {request.adminNotes}
                        </Typography>
                      </div>
                    )}
                    <div className="border-border-muted mb-3 overflow-hidden rounded-lg border">
                      <table className="w-full text-xs">
                        <tbody className="divide-border-muted/60 divide-y">
                          {request.items.map((item) => {
                            const bottles = lineFor(item.id, item.bottles);

                            return (
                              <tr key={item.id}>
                                <td className="px-3 py-2">
                                  {lineLabel(
                                    item.productName,
                                    item.vintage,
                                    item.bottleSize,
                                    item.caseConfig,
                                  )}
                                  {item.lotNumber && (
                                    <span className="text-text-muted ml-2 font-mono text-[11px]">
                                      lot {item.lotNumber}
                                    </span>
                                  )}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 text-right">
                                  {isEditable ? (
                                    <span className="inline-flex items-center gap-0.5">
                                      <button
                                        type="button"
                                        aria-label="One fewer bottle"
                                        disabled={bottles <= 1}
                                        onClick={() =>
                                          setEditLines((current) =>
                                            new Map(current).set(
                                              item.id,
                                              bottles - 1,
                                            ),
                                          )
                                        }
                                        className="text-text-muted hover:bg-fill-muted h-6 w-6 rounded transition-colors disabled:opacity-30"
                                      >
                                        &minus;
                                      </button>
                                      <span className="min-w-[24px] text-center tabular-nums">
                                        {bottles}
                                      </span>
                                      <button
                                        type="button"
                                        aria-label="One more bottle"
                                        onClick={() =>
                                          setEditLines((current) =>
                                            new Map(current).set(
                                              item.id,
                                              bottles + 1,
                                            ),
                                          )
                                        }
                                        className="text-text-muted hover:bg-fill-muted h-6 w-6 rounded transition-colors"
                                      >
                                        +
                                      </button>
                                      <span className="text-text-muted ml-1">
                                        {bottles === 1 ? 'bottle' : 'bottles'}
                                      </span>
                                      <button
                                        type="button"
                                        aria-label={`Remove ${item.productName}`}
                                        onClick={() =>
                                          setEditLines((current) =>
                                            new Map(current).set(item.id, 0),
                                          )
                                        }
                                        className="text-text-muted hover:text-text-primary ml-1 px-1 transition-colors"
                                      >
                                        &times;
                                      </button>
                                    </span>
                                  ) : (
                                    <span className="tabular-nums">
                                      {item.bottles}{' '}
                                      {item.bottles === 1
                                        ? 'bottle'
                                        : 'bottles'}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {isEditable ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          colorRole="brand"
                          isDisabled={isAmending || editLines.size === 0}
                          onClick={() => {
                            const lines = request.items
                              .map((item) => ({
                                stockId: item.stockId ?? '',
                                bottles: lineFor(item.id, item.bottles),
                              }))
                              .filter(
                                (line) => line.stockId && line.bottles > 0,
                              );

                            if (lines.length === 0) {
                              toast.error(
                                'A request needs at least one wine. Withdraw it instead.',
                              );
                              return;
                            }

                            amendRelease({
                              requestId: request.id,
                              lines,
                            });
                          }}
                        >
                          <ButtonContent>Save changes</ButtonContent>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          isDisabled={isWithdrawing}
                          onClick={() =>
                            withdrawRelease({ requestId: request.id })
                          }
                        >
                          <ButtonContent>Withdraw request</ButtonContent>
                        </Button>
                        <Typography variant="bodyXs" colorRole="muted">
                          Changes can be made until we issue your costs.
                        </Typography>
                      </div>
                    ) : (
                      <Typography variant="bodyXs" colorRole="muted">
                        This request has been priced, so its contents are now
                        fixed. Accept the quotation, or contact us if it needs
                        to change.
                      </Typography>
                    )}
                  </div>
                )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/*
        Search and filters on one line above small screens. Stacked, they cost
        three bands of vertical space before a member sees a single wine.
      */}
      <div className="mb-3 lg:flex lg:items-center lg:gap-4">
        <div className="relative lg:w-80 lg:flex-shrink-0">
          <Icon
            icon={IconSearch}
            size="sm"
            className="text-text-muted pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search wine, producer or vintage"
            className="pl-9"
          />
        </div>

        <div className="-mx-3 mt-2 flex gap-1.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 lg:mt-0">
        {filters.map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={() => setQuickFilter(filter.key)}
            className={`flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              quickFilter === filter.key
                ? 'bg-fill-brand text-text-on-brand'
                : 'border-border-muted text-text-muted hover:text-text-primary border'
            }`}
          >
            {filter.label}
          </button>
          ))}
          <Typography
            variant="bodyXs"
            colorRole="muted"
            className="ml-auto hidden flex-shrink-0 self-center lg:block"
          >
            {rows.length} {rows.length === 1 ? 'wine' : 'wines'}
          </Typography>
        </div>
      </div>


      <div className="border-border-muted overflow-x-auto rounded-xl border sm:max-h-[72vh] sm:overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-fill-muted/60 border-border-muted sticky top-0 z-10 border-b backdrop-blur">
            <tr>
              <th className="w-8 px-2 py-2.5" />
              <th className={`${th} min-w-[220px] text-left`}>Wine</th>
              <th className={`${th} hidden text-left md:table-cell`}>Producer</th>
              <th className={`${th} hidden text-center sm:table-cell`}>Vintage</th>
              <th className={`${th} hidden text-center sm:table-cell`}>Size</th>
              <th className={`${th} hidden text-center md:table-cell`}>Pack</th>
              <th className={`${th} hidden text-right sm:table-cell`}>Cases</th>
              <th className={`${th} text-right`}>Bottles</th>
              <th className={`${th} hidden text-right lg:table-cell`}>
                {currency === 'AED' ? 'AED' : '$'} / btl
              </th>
              <th className={`${th} min-w-[150px] text-right`}>Request</th>
            </tr>
          </thead>
          <tbody className="divide-border-muted divide-y">
            {isLoading && (
              <tr>
                <td colSpan={10} className="text-text-muted px-3 py-8 text-center">
                  Loading your cellar...
                </td>
              </tr>
            )}

            {!isLoading && !rows.length && (
              <tr>
                <td colSpan={10} className="text-text-muted px-3 py-10 text-center">
                  {search || quickFilter !== 'all'
                    ? 'No wines match that filter.'
                    : 'Nothing is held in your cellar yet.'}
                </td>
              </tr>
            )}

            {rows.map((wine) => {
              const isOpen = openWine === wine.lwin18;
              const history = movementsByWine.get(wine.lwin18) ?? [];

              return (
                <Fragment key={wine.lwin18}>
                  <tr
                    onClick={() => setOpenWine(isOpen ? null : wine.lwin18)}
                    /*
                      Colour marks state, not decoration. A wine already in the
                      request is tinted and carries a rail, so a member
                      scrolling sixty-five lines can see what they have picked
                      without reading a single number.
                    */
                    className={`group cursor-pointer transition-colors ${
                      basketBottlesOf(wine) > 0
                        ? 'bg-fill-brand/[0.06] shadow-[inset_2px_0_0_0] shadow-teal-400'
                        : 'hover:bg-fill-muted/40'
                    }`}
                  >
                    <td className="px-2 py-2.5">
                      <Icon
                        icon={IconChevronDown}
                        size="sm"
                        className={`text-text-muted transition-transform ${
                          isOpen ? '' : '-rotate-90'
                        }`}
                      />
                    </td>
                    <td className={`${td} text-text-primary font-medium`}>
                      {displayName(wine.productName)}
                      <span className="text-text-muted block text-xs sm:hidden">
                        {wine.producer}
                        {wine.vintage ? ` · ${wine.vintage}` : ''}
                        {wine.bottleSize ? ` · ${wine.bottleSize}` : ''}
                        {wine.totalCases
                          ? ` · ${wine.totalCases} ${wine.totalCases === 1 ? 'case' : 'cases'}`
                          : ''}
                      </span>
                    </td>
                    <td className={`${tdMuted} hidden md:table-cell`}>
                      {wine.producer ?? '—'}
                    </td>
                    <td
                      className={`${tdMuted} hidden text-center tabular-nums sm:table-cell`}
                    >
                      {wine.vintage ?? 'NV'}
                    </td>
                    {/*
                      With the format trimmed out of the name, this column is
                      what tells one row from the next. It cannot be the
                      faintest thing on the row.
                    */}
                    <td
                      className={`${td} text-text-primary hidden text-center sm:table-cell`}
                    >
                      {wine.bottleSize ?? '—'}
                    </td>
                    <td className={`${tdMuted} hidden text-center tabular-nums md:table-cell`}>
                      {wine.caseConfig ?? '—'}
                    </td>
                    <td
                      className={`${tdMuted} hidden text-right tabular-nums sm:table-cell`}
                    >
                      {wine.totalCases}
                    </td>
                    <td
                      className={`${td} text-text-primary text-right font-semibold tabular-nums`}
                    >
                      {bottlesOf(wine)}
                    </td>
                    <td
                      className={`${tdMuted} hidden text-right tabular-nums lg:table-cell`}
                    >
                      {wine.costPerBottle
                        ? money(wine.costPerBottle, true)
                        : '—'}
                    </td>
                    {/*
                      Adding a wine should not require opening it. Selecting
                      twenty lines meant twenty expansions and twenty typed
                      numbers, which is why requests were going out one wine at
                      a time.
                    */}
                    <td
                      className={`${td} text-right`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {(() => {
                        const chosen = basketBottlesOf(wine);
                        const held = bottlesOf(wine);
                        const pack = wine.caseConfig ?? 1;

                        /*
                          The count replaced the controls, so a member could
                          add one bottle and then had no way to add a second
                          without opening the row. It keeps its controls.
                        */
                        if (chosen > 0) {
                          return (
                            <span className="inline-flex items-center gap-0.5">
                              <button
                                type="button"
                                aria-label={`One fewer bottle of ${wine.productName}`}
                                onClick={() => addToWine(wine, -1)}
                                className="text-text-muted hover:bg-fill-muted hover:text-text-primary h-6 w-6 rounded transition-colors"
                              >
                                &minus;
                              </button>
                              <span className="text-text-brand min-w-[46px] text-center text-xs font-semibold tabular-nums">
                                {chosen} of {held}
                              </span>
                              <button
                                type="button"
                                aria-label={`One more bottle of ${wine.productName}`}
                                disabled={chosen >= held}
                                onClick={() => addToWine(wine, 1)}
                                className="text-text-muted hover:bg-fill-muted hover:text-text-primary h-6 w-6 rounded transition-colors disabled:opacity-30"
                              >
                                +
                              </button>
                              {pack > 1 && chosen + pack <= held && (
                                <button
                                  type="button"
                                  onClick={() => addToWine(wine, pack)}
                                  className="text-text-muted hover:bg-fill-brand/10 hover:text-text-brand ml-0.5 rounded px-1.5 py-1 text-[11px] font-medium transition-colors"
                                >
                                  + Case
                                </button>
                              )}
                              <button
                                type="button"
                                aria-label={`Remove ${wine.productName} from the request`}
                                onClick={() => clearWine(wine)}
                                className="text-text-muted hover:text-text-primary rounded px-1 text-xs transition-colors"
                              >
                                &times;
                              </button>
                            </span>
                          );
                        }

                        /*
                          Two outlined boxes on sixty-five rows is a wall of
                          buttons. They sit quiet until the row is under the
                          cursor, which is the only time they can be used.
                        */
                        return (
                          <span className="inline-flex items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                            {pack > 1 && (
                              <button
                                type="button"
                                onClick={() => addToWine(wine, pack)}
                                className="hover:bg-fill-brand/10 hover:text-text-brand text-text-muted rounded px-1.5 py-1 text-xs font-medium transition-colors"
                              >
                                + Case
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => addToWine(wine, 1)}
                              className="hover:bg-fill-brand/10 hover:text-text-brand text-text-muted rounded px-1.5 py-1 text-xs font-medium transition-colors"
                            >
                              + Bottle
                            </button>
                          </span>
                        );
                      })()}
                    </td>
                  </tr>

                  {isOpen && (
                    <tr className="bg-fill-brand/[0.04] shadow-[inset_2px_0_0_0] shadow-teal-400">
                      <td colSpan={10} className="px-4 py-3 sm:px-10">
                        {/*
                          One line per parcel actually held. A wine received on
                          two occasions is two holdings with two histories, and
                          collapsing them to a single total is the warehouse's
                          convenience rather than the owner's record.
                        */}
                        <Typography
                          variant="bodyXs"
                          className="text-text-muted mb-2 block font-semibold uppercase tracking-wider"
                        >
                          <span className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-teal-400 align-middle" />
                          Cases held &mdash; {wine.locations.length} record
                          {wine.locations.length === 1 ? '' : 's'}
                        </Typography>

                        <div className="border-border-muted bg-background-primary mb-4 max-w-full overflow-x-auto rounded-lg border">
                          <table className="w-full min-w-[440px] text-sm">
                            <thead>
                              <tr className="text-text-muted border-border-muted border-b text-[11px] uppercase tracking-wider">
                                <th className="whitespace-nowrap px-4 py-1.5 text-right">Cases</th>
                                <th className="whitespace-nowrap px-4 py-1.5 text-center">Pack</th>
                                <th className="whitespace-nowrap px-4 py-1.5 text-right">Bottles</th>
                                <th className="hidden whitespace-nowrap px-4 py-1.5 text-left sm:table-cell">
                                  Lot
                                </th>
                                <th className="whitespace-nowrap px-4 py-1.5 text-left">In bond since</th>
                                <th className="whitespace-nowrap px-4 py-1.5 text-left">Status</th>
                                <th className="whitespace-nowrap px-4 py-1.5 text-right">
                                  Bottles to release
                                </th>
                                <th className="px-4 py-1.5 text-right" />
                              </tr>
                            </thead>
                            <tbody className="divide-border-muted/60 divide-y">
                              {wine.locations.map((parcel) => (
                                <tr
                                  key={parcel.stockId}
                                >
                                  <td className="whitespace-nowrap px-4 py-2 text-right font-semibold tabular-nums">
                                    {parcel.quantityCases}
                                  </td>
                                  <td className="text-text-muted whitespace-nowrap px-4 py-2 text-center tabular-nums">
                                    {wine.caseConfig ?? 1} &times;{' '}
                                    {wine.bottleSize ?? '75cl'}
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">
                                    {parcel.quantityCases * (wine.caseConfig ?? 1)}
                                  </td>
                                  <td className="text-text-muted hidden whitespace-nowrap px-4 py-2 font-mono text-xs sm:table-cell">
                                    {parcel.lotNumber ?? '—'}
                                  </td>
                                  <td className="text-text-muted whitespace-nowrap px-4 py-2">
                                    {parcel.receivedAt
                                      ? format(
                                          new Date(parcel.receivedAt),
                                          'MMM yyyy',
                                        )
                                      : '—'}
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-2">
                                    {parcel.reservedCases > 0 ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                        {parcel.reservedCases} allocated
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700">
                                        <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
                                        In bond
                                      </span>
                                    )}
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-2 text-right">
                                    {(() => {
                                      const inBasket = basket.get(parcel.stockId) ?? 0;
                                      const pack = wine.caseConfig ?? 1;
                                      const held = parcel.quantityCases * pack;

                                      return (
                                        <span
                                          className="inline-flex items-center gap-1"
                                          onClick={(event) =>
                                            event.stopPropagation()
                                          }
                                        >
                                          {pack > 1 && (
                                            <button
                                              type="button"
                                              aria-label={`Add a case of ${wine.productName}`}
                                              disabled={inBasket + pack > held}
                                              onClick={() =>
                                                setParcelBottles(
                                                  parcel.stockId,
                                                  inBasket + pack,
                                                  held,
                                                )
                                              }
                                              className="border-border-muted hover:bg-fill-brand/10 hover:text-text-brand mr-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-40"
                                            >
                                              + Case
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            aria-label={`One fewer bottle of ${wine.productName}`}
                                            disabled={inBasket === 0}
                                            onClick={() =>
                                              setParcelBottles(
                                                parcel.stockId,
                                                inBasket - 1,
                                                held,
                                              )
                                            }
                                            className="border-border-muted hover:bg-fill-muted h-7 w-7 rounded-md border text-xs transition-colors disabled:opacity-40"
                                          >
                                            &minus;
                                          </button>
                                          <input
                                            type="number"
                                            min={0}
                                            max={held}
                                            value={inBasket || ''}
                                            placeholder="0"
                                            aria-label={`Bottles of ${wine.productName} to request`}
                                            onChange={(event) =>
                                              setParcelBottles(
                                                parcel.stockId,
                                                Number(event.target.value) || 0,
                                                held,
                                              )
                                            }
                                            className="border-border-muted bg-background-primary h-7 w-12 rounded-md border px-1 text-center text-xs tabular-nums"
                                          />
                                          <button
                                            type="button"
                                            aria-label={`One more bottle of ${wine.productName}`}
                                            disabled={inBasket >= held}
                                            onClick={() =>
                                              setParcelBottles(
                                                parcel.stockId,
                                                inBasket + 1,
                                                held,
                                              )
                                            }
                                            className="border-border-muted hover:bg-fill-muted h-7 w-7 rounded-md border text-xs transition-colors disabled:opacity-40"
                                          >
                                            +
                                          </button>
                                          <span className="text-text-muted text-[11px]">
                                            / {held}
                                          </span>
                                        </span>
                                      );
                                    })()}
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-2 text-right">
                                    {(() => {
                                      const open = requestByStock.get(parcel.stockId);

                                      /*
                                        A control that always offers the action
                                        and then refuses it is telling the
                                        member about their own request through
                                        an error. Show the state instead.
                                      */
                                      if (open) {
                                        return (
                                          <span className="text-text-muted text-xs">
                                            Report requested &middot;{' '}
                                            <span className="font-mono">
                                              {open.requestNumber}
                                            </span>
                                          </span>
                                        );
                                      }

                                      return (
                                        <span className="inline-flex items-center gap-0.5">
                                          <button
                                            type="button"
                                            disabled={isRequesting}
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              requestReport({
                                                stockId: parcel.stockId,
                                              });
                                            }}
                                            className="text-text-brand hover:bg-fill-brand/10 -my-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                                          >
                                            Request condition report
                                          </button>
                                          {/*
                                            A chargeable action should say what
                                            it costs before it is clicked, not
                                            on the invoice afterwards.
                                          */}
                                          <Tooltip>
                                            <TooltipTrigger
                                              onClick={(event) =>
                                                event.stopPropagation()
                                              }
                                              aria-label="What a condition report includes"
                                            >
                                              <Icon
                                                icon={IconInfoCircle}
                                                size="xs"
                                                colorRole="muted"
                                              />
                                            </TooltipTrigger>
                                            <TooltipContent
                                              side="left"
                                              className="max-w-[240px] text-left lg:max-w-[240px]"
                                            >
                                              <Typography variant="bodyXs">
                                                <strong>AED 150</strong> per
                                                parcel. Each bottle is
                                                inspected &mdash; fill level,
                                                label, capsule and closure
                                                &mdash; and reported with
                                                photographs and written notes.
                                                Charged on your next invoice.
                                              </Typography>
                                            </TooltipContent>
                                          </Tooltip>
                                        </span>
                                      );
                                    })()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {history.length > 0 && (
                          <>
                            <div className="mb-2 flex items-center gap-1.5">
                              <Icon
                                icon={IconHistory}
                                size="sm"
                                className="text-text-muted"
                              />
                              <Typography
                                variant="bodyXs"
                                className="text-text-muted font-semibold uppercase tracking-wider"
                              >
                                <span className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-teal-400/60 align-middle" />
                                Movement history &mdash; {history.length} record
                                {history.length === 1 ? '' : 's'}
                              </Typography>
                            </div>

                            {/*
                              The same shape as the warehouse's own history, so
                              it is familiar to whoever answers the phone about
                              it — minus the bay codes, the staff names and the
                              operational notes, none of which are the owner's
                              business or interest.
                            */}
                            <div className="border-border-muted bg-background-primary inline-block max-w-full overflow-x-auto rounded-lg border align-top">
                              <table className="w-auto text-sm">
                                <thead>
                                  <tr className="text-text-muted border-border-muted border-b text-[11px] uppercase tracking-wider">
                                    <th className="whitespace-nowrap px-4 py-1.5 text-left">
                                      When
                                    </th>
                                    <th className="whitespace-nowrap px-4 py-1.5 text-left">
                                      Type
                                    </th>
                                    <th className="whitespace-nowrap px-4 py-1.5 text-right">
                                      Cases
                                    </th>
                                    <th className="whitespace-nowrap px-4 py-1.5 text-left">
                                      Reference
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-border-muted/60 divide-y">
                                  {history.map((movement) => (
                                    <tr key={movement.id}>
                                      <td className="text-text-muted whitespace-nowrap px-4 py-2">
                                        {movement.performedAt
                                          ? format(
                                              new Date(movement.performedAt),
                                              'd MMM yyyy',
                                            )
                                          : '—'}
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-2">
                                        <MovementTypeBadge
                                          movementType={
                                            movement.movementType as MovementTypeBadgeProps['movementType']
                                          }
                                          size="sm"
                                        />
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">
                                        {movement.quantityCases ?? '—'}
                                      </td>
                                      <td className="text-text-muted whitespace-nowrap px-4 py-2 font-mono text-xs">
                                        {movement.movementNumber ?? '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {basket.size > 0 && (
        <div className="border-border-brand bg-background-primary sticky bottom-4 z-20 mt-6 overflow-hidden rounded-xl border shadow-lg">
          <div className="h-1 bg-gradient-to-r from-teal-400 via-teal-300 to-teal-200" />
          <div className="p-4">
          <div className="flex flex-col gap-3">
            {(() => {
              const bottles = [...basket.values()].reduce(
                (sum, count) => sum + count,
                0,
              );

              const wineCount = new Set(
                basketLines.map((line) => line.wine?.lwin18),
              ).size;

              return (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Typography
                        variant="bodyXs"
                        className="text-text-brand font-semibold uppercase tracking-wider"
                      >
                        Delivery request
                      </Typography>
                      <Typography variant="bodySm" className="font-semibold">
                        {bottles} {bottles === 1 ? 'bottle' : 'bottles'} from{' '}
                        {wineCount} {wineCount === 1 ? 'wine' : 'wines'}
                      </Typography>
                      {estimate?.priced && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1">
                          <Typography
                            variant="bodyXs"
                            className="font-semibold text-teal-800"
                          >
                            {isEstimating
                              ? 'Estimating…'
                              : `Estimated ${money(estimate.totalUsd)} to deliver`}
                          </Typography>
                          {/*
                            Named an estimate every time it is shown. A figure
                            a member reads as a price and is later charged
                            differently is worse than no figure at all.
                          */}
                          <Tooltip>
                            <TooltipTrigger aria-label="How this estimate is worked out">
                              <Icon
                                icon={IconInfoCircle}
                                size="xs"
                                className="text-teal-700"
                              />
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              className="max-w-[240px] text-left lg:max-w-[240px]"
                            >
                              {/*
                                Three short statements rather than one long
                                one. A tooltip is read standing up, and the
                                first thing it has to answer is the thing the
                                member would otherwise assume.
                              */}
                              <div className="flex flex-col gap-1.5 text-left">
                                <Typography
                                  variant="bodyXs"
                                  className="font-semibold"
                                >
                                  You already own the wine. This is the cost of
                                  releasing it.
                                </Typography>
                                <Typography variant="bodyXs">
                                  Duty, VAT, clearance, transfer out of bond,
                                  licensed delivery, and our handling.
                                </Typography>
                                <Typography variant="bodyXs" colorRole="muted">
                                  Duty follows the declared value, so a finer
                                  case costs more to release. We confirm the
                                  figure before anything moves.
                                </Typography>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </span>
                      )}
                    </div>

                    {/*
                      Collapsed until it is needed. Left open, the panel
                      covered three rows of the cellar the member was still
                      choosing from, and looked like an action on whichever
                      wine it happened to be sitting over.
                    */}
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <Button
                        size="sm"
                        colorRole="brand"
                        onClick={() => setIsBasketOpen(!isBasketOpen)}
                      >
                        <ButtonContent>
                          {isBasketOpen ? 'Add more bottles' : 'Review and send'}
                        </ButtonContent>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setBasket(new Map())}
                      >
                        <ButtonContent>Clear</ButtonContent>
                      </Button>
                    </div>
                  </div>

                  {/*
                    One request, and it says so. Without the list the panel
                    looked like an action on whichever wine happened to be
                    open, so members were sending a request per wine.
                  */}
                  {mergeTarget && (
                    <Typography
                      variant="bodyXs"
                      colorRole="muted"
                      className="mt-1 block"
                    >
                      These will be added to{' '}
                      <span className="font-mono">
                        {mergeTarget.requestNumber}
                      </span>
                      , so everything travels as a single delivery.
                    </Typography>
                  )}
                  {isBasketOpen && (
                    <div className="border-border-muted mt-2 max-h-[30vh] overflow-y-auto rounded-lg border">
                      <table className="w-full text-xs">
                        <tbody className="divide-border-muted/60 divide-y">
                          {basketLines.map((line) => {
                            const parcel = line.wine?.locations.find(
                              (location) => location.stockId === line.stockId,
                            );

                            return (
                            <tr key={line.stockId}>
                              <td className="px-3 py-1.5">
                                {line.wine
                                  ? lineLabel(
                                      line.wine.productName,
                                      line.wine.vintage,
                                      line.wine.bottleSize,
                                      line.wine.caseConfig,
                                    )
                                  : ''}
                                {parcel?.lotNumber && (
                                  <span className="text-text-muted ml-2 font-mono text-[11px]">
                                    lot {parcel.lotNumber}
                                  </span>
                                )}
                              </td>
                              <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                                {describeQuantity(
                                  line.bottles,
                                  line.wine?.caseConfig ?? null,
                                )}
                              </td>
                              <td className="w-8 px-2 py-1.5 text-right">
                                <button
                                  type="button"
                                  aria-label={`Remove ${line.wine?.productName}`}
                                  onClick={() =>
                                    setParcelBottles(line.stockId, 0, 0)
                                  }
                                  className="text-text-muted hover:text-text-primary px-1 transition-colors"
                                >
                                  &times;
                                </button>
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
            })()}
            {/*
               Labelled, not placeholder-led. A placeholder vanishes the moment
               someone types, taking the only explanation of the field with it.
             */}
            <div
              className={`grid gap-3 sm:grid-cols-2 ${isBasketOpen ? '' : 'hidden'}`}
            >
              {/*
                 The address lives on the account. Retyped into every request
                 it becomes four spellings of the same villa, and the team
                 cannot tell which one is current.
               */}
              <div className="block">
                <span className="text-text-muted mb-1 block text-[11px] font-semibold uppercase tracking-wider">
                  Delivery address
                </span>
                {savedAddress && !isEditingAddress ? (
                  <div className="border-border-muted bg-fill-muted/40 flex items-start justify-between gap-3 rounded-lg border px-3 py-2">
                    <div className="min-w-0">
                      <Typography variant="bodySm">{savedAddress}</Typography>
                      {profile?.deliveryInstructions && (
                        <Typography
                          variant="bodyXs"
                          colorRole="muted"
                          className="mt-0.5 block"
                        >
                          {profile.deliveryInstructions}
                        </Typography>
                      )}
                    </div>
                    <button
                      type="button"
                      className="text-text-brand flex-shrink-0 text-xs font-semibold hover:underline"
                      onClick={() => {
                        setAddress(savedAddress);
                        setShouldSaveAddress(false);
                        setIsEditingAddress(true);
                      }}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <>
                    <Input
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      placeholder="Villa or office, area, emirate"
                    />
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <label className="text-text-muted flex items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          checked={shouldSaveAddress}
                          onChange={(event) =>
                            setShouldSaveAddress(event.target.checked)
                          }
                        />
                        {savedAddress
                          ? 'Make this my address from now on'
                          : 'Save this to my account'}
                      </label>
                      {savedAddress && (
                        <button
                          type="button"
                          className="text-text-muted text-xs hover:underline"
                          onClick={() => {
                            setIsEditingAddress(false);
                            setAddress('');
                          }}
                        >
                          Use my saved address
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
              <label className="block">
                <span className="text-text-muted mb-1 block text-[11px] font-semibold uppercase tracking-wider">
                  Notes for our team &mdash; optional
                </span>
                <Input
                  value={memberNotes}
                  onChange={(event) => setMemberNotes(event.target.value)}
                  placeholder="Preferred timing, access, anything else"
                />
              </label>
            </div>
            <div
              className={`flex flex-wrap items-center gap-2 ${isBasketOpen ? '' : 'hidden'}`}
            >
              <Button
                size="sm"
                colorRole="brand"
                isDisabled={isSaving}
                onClick={() => {
                  /*
                    Saved before the request is raised, not after: the request
                    stores its own copy of the address, so an account updated
                    afterwards would leave this one pointing at the old place.
                  */
                  if (
                    isEditingAddress &&
                    shouldSaveAddress &&
                    effectiveAddress &&
                    effectiveAddress !== savedAddress
                  ) {
                    saveAddress({
                      deliveryAddress: effectiveAddress,
                    });
                  }

                  saveRelease({
                    deliveryAddress: effectiveAddress || undefined,
                    memberNotes: memberNotes || undefined,
                    lines: [...basket.entries()].map(([stockId, bottles]) => ({
                      stockId,
                      bottles,
                    })),
                  });
                }}
              >
                <ButtonContent>Request delivery</ButtonContent>
              </Button>
              <Typography variant="bodyXs" colorRole="muted">
                You will receive costs for approval before any wine leaves
                bond.
              </Typography>
            </div>
          </div>
          </div>
        </div>
      )}

      {/*
        One place to edit an account detail, and this is not it. The panel
        summarises and links; two editors for one address is how they end up
        disagreeing.
      */}
      <section className="border-border-muted mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-4">
        <div className="min-w-0">
          <Typography variant="bodySm" className="font-semibold">
            Delivery details
          </Typography>
          {profile?.deliveryAddress ? (
            <Typography variant="bodyXs" colorRole="muted" className="mt-0.5 block">
              {profile.deliveryAddress}
              {profile.documents.length === 0 && ' · no ID on file'}
            </Typography>
          ) : (
            <Typography variant="bodyXs" colorRole="muted" className="mt-0.5 block">
              No delivery address yet. Add one and it will be filled in
              whenever you call wines forward.
            </Typography>
          )}
        </div>
        <Link href="/platform/cellar/profile">
          <Button variant="outline" size="sm">
            <ButtonContent>
              {profile?.deliveryAddress ? 'Your details' : 'Add your details'}
            </ButtonContent>
          </Button>
        </Link>
      </section>

      {/*
        The same four facts the membership was sold on, in the same words. A
        member who was told the wine sits at twelve to fourteen degrees under
        CCTV should be able to see that stated where the wine is, not only in
        the document that persuaded them.
      */}
      <section className="border-border-muted mt-8 overflow-hidden rounded-xl border">
        <div className="border-border-muted flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2.5">
          <Typography
            variant="bodyXs"
            className="font-semibold uppercase tracking-wider"
          >
            The warehouse
          </Typography>
          <Typography variant="bodyXs" colorRole="muted">
            Craft &amp; Culture &mdash; Ras Al Khaimah
          </Typography>
        </div>
        <dl className="divide-border-muted/60 grid gap-px sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              term: 'Temperature',
              detail: '12–14°C, continuously logged',
            },
            {
              term: 'Status',
              detail: 'UAE licensed bonded — duty suspended, not deferred',
            },
            {
              term: 'Security',
              detail: 'CCTV, humidity control, restricted access',
            },
            {
              term: 'Handling',
              detail: 'Receiving, putaway, picking and dispatch in house',
            },
          ].map((fact) => (
            <div key={fact.term} className="px-4 py-3">
              <dt className="text-text-muted mb-0.5 text-[11px] font-semibold uppercase tracking-wider">
                {fact.term}
              </dt>
              <dd className="text-text-primary m-0 text-xs leading-relaxed">
                {fact.detail}
              </dd>
            </div>
          ))}
        </dl>
        <div className="border-border-muted border-t px-4 py-3">
          <Typography
            variant="bodyXs"
            colorRole="muted"
            className="block max-w-[80ch] leading-relaxed"
          >
            Cold-chain records are held against the wine itself &mdash; the
            conditions it was kept in, and the journey from producer to
            delivery &mdash; and travel with it on release. There is no charge
            for them.
          </Typography>
        </div>
      </section>

      <div className="border-border-muted mt-8 border-t pt-6">
        {/*
          Three separate facts read as three, not as a paragraph. Each one
          answers a question a member will actually ask, so each gets a label
          they can find it by.
        */}
        <dl className="grid gap-x-10 gap-y-5 sm:grid-cols-3">
          {[
            {
              term: 'Duty',
              detail:
                'Wine held in bond is duty suspended. Duties, taxes and delivery become payable only on release to the mainland, and are quoted before anything moves.',
            },
            {
              term: 'Allocated',
              detail: 'Cases committed against an order already placed.',
            },
            {
              term: 'Import cost',
              detail:
                'The value declared when the wine was brought into bond. Not a market valuation.',
            },
          ].map((note) => (
            <div key={note.term}>
              <dt className="text-text-muted mb-1 text-[11px] font-semibold uppercase tracking-wider">
                {note.term}
              </dt>
              <dd className="text-text-muted m-0 max-w-[46ch] text-xs leading-relaxed">
                {note.detail}
              </dd>
            </div>
          ))}
        </dl>

        <div className="border-border-muted mt-6 border-t pt-5">
          <Typography variant="bodySm" className="block">
            To call wines forward, consolidate a new purchase into your cellar,
            or offer wine for resale through the C&amp;C network, contact{' '}
            <a
              className="text-text-brand font-medium"
              href="mailto:enquiries@craftculture.xyz"
            >
              enquiries@craftculture.xyz
            </a>
            .
          </Typography>
        </div>
      </div>

    </div>
  );
};

export default CellarPage;
