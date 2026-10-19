'use client';

import {
  IconBottle,
  IconBuildingWarehouse,
  IconChevronDown,
  IconCoin,
  IconDownload,
  IconFileText,
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

import ConfirmAction from '@/app/_cellar/components/ConfirmAction';
import DeliveriesPanel from '@/app/_cellar/components/DeliveriesPanel';
import DeliveryOptionsForm, {
  EMPTY_DELIVERY_CHOICE,
} from '@/app/_cellar/components/DeliveryOptionsForm';
import type { DeliveryChoice } from '@/app/_cellar/components/DeliveryOptionsForm';
import UkHoldingsPanel from '@/app/_cellar/components/UkHoldingsPanel';
import ViewOnlyNotice from '@/app/_cellar/components/ViewOnlyNotice';
import CellarOverviewPanel from '@/app/_onboarding/components/CellarOverviewPanel';
import useActivationGate from '@/app/_onboarding/hooks/useActivationGate';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import DialogDescription from '@/app/_ui/components/Dialog/DialogDescription';
import DialogHeader from '@/app/_ui/components/Dialog/DialogHeader';
import DialogTitle from '@/app/_ui/components/Dialog/DialogTitle';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Tooltip from '@/app/_ui/components/Tooltip/Tooltip';
import TooltipContent from '@/app/_ui/components/Tooltip/TooltipContent';
import TooltipTrigger from '@/app/_ui/components/Tooltip/TooltipTrigger';
import Typography from '@/app/_ui/components/Typography/Typography';
import MovementTypeBadge from '@/app/_wms/components/MovementTypeBadge';
import type { MovementTypeBadgeProps } from '@/app/_wms/components/MovementTypeBadge';
import CONDITION_REPORT_FEE_AED from '@/app/_wms/constants/conditionReportFee';
import displayWineName from '@/app/_wms/utils/displayWineName';
import useTRPC from '@/lib/trpc/browser';

interface CellarParcel {
  stockId: string;
  locationId: string;
  quantityCases: number;
  reservedCases: number;
  /*
    What can actually be committed. Offering wine that is already reserved
    against somebody's order would mean withdrawing the offer later, so the
    sell dialog caps on this rather than on the total in the bay.
  */
  availableCases: number;
  /* Bottles already on an open offer or delivery request */
  claimedBottles: number;
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
  /** Members only: our in-bond list price where we list the wine, else costPerBottle */
  indicativePerBottle?: number | null;
  indicativeFromList?: boolean;
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

/* The one primary action style on member screens: near-black, not brand teal */
const DARK_ACTION =
  'border-transparent bg-text-primary text-surface-primary fill-surface-primary hover:border-transparent hover:bg-text-primary hover:opacity-90 active:bg-text-primary';

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
  const { catchActivation, activationSheet } = useActivationGate();
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [openWine, setOpenWine] = useState<string | null>(null);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    ...api.wms.partner.getStock.queryOptions(),
  });

  /* What the member has picked, in bottles, keyed by the parcel it comes from. */
  const [basket, setBasket] = useState<Map<string, number>>(new Map());

  /*
    A collector is billed and thinks in dirhams; a trade owner prices in
    dollars. The toggle wins once pressed.
  */
  const [currencyChoice, setCurrency] = useState<Currency | null>(null);
  const currency: Currency =
    currencyChoice ??
    (data?.partner.type === 'private_collector' ? 'AED' : 'USD');

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
  const [deliveryChoice, setDeliveryChoice] = useState<DeliveryChoice>(
    EMPTY_DELIVERY_CHOICE,
  );
  const [memberNotes, setMemberNotes] = useState('');
  /* Set only when the member chooses to send this one somewhere else. */
  const [isBasketOpen, setIsBasketOpen] = useState(false);
  /* The wine being offered for sale, and the terms while they are being set. */
  const [sellingWine, setSellingWine] = useState<CellarWine | null>(null);
  const [sellLines, setSellLines] = useState<Map<string, number>>(new Map());
  const [sellAsk, setSellAsk] = useState('');
  /* Which submitted request is open, and the edits made to it so far. */
  const [openRequestId, setOpenRequestId] = useState<string | null>(null);
  const [editLines, setEditLines] = useState<Map<string, number>>(new Map());

  const { data: profile, refetch: refetchProfile } = useQuery({
    ...api.cellar.member.getProfile.queryOptions(),
  });

  /* A view-only guest is refused every change on the server; offer none */
  const isViewer = profile?.cellarRole === 'viewer';

  const { data: addressData, refetch: refetchAddresses } = useQuery({
    ...api.cellar.member.getAddresses.queryOptions(),
  });

  const savedAddresses = addressData?.addresses ?? [];

  const { mutateAsync: saveAddress, isPending: isSavingAddress } = useMutation(
    api.cellar.member.saveAddress.mutationOptions({
      onSuccess: () => {
        void refetchAddresses();
        void refetchProfile();
      },
    }),
  );

  const { data: releaseData, refetch: refetchReleases } = useQuery({
    ...api.cellar.member.getReleases.queryOptions(),
  });

  const { mutate: submitRelease } = useMutation(
    api.cellar.member.submitRelease.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          `Delivery request ${result.requestNumber} sent. We will confirm the costs for your approval.`,
        );
        setBasket(new Map());
        setDeliveryChoice(EMPTY_DELIVERY_CHOICE);
        setMemberNotes('');
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
          setDeliveryChoice(EMPTY_DELIVERY_CHOICE);
          setIsBasketOpen(false);
          void refetchReleases();
          return;
        }

        submitRelease({ requestId: result.requestId });
      },
      onError: (error) => {
        if (!catchActivation(error, 'release')) toast.error(error.message);
      },
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

  const { mutate: offerForSale, isPending: isOffering } = useMutation(
    api.consignment.member.offerForSale.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          `${result.mandateNumber} sent — we will come back to you once it is listed.`,
        );
        setSellingWine(null);
        setSellLines(new Map());
        setSellAsk('');
        void refetch();
      },
      onError: (error) => {
        if (!catchActivation(error, 'offer_for_sale')) toast.error(error.message);
      },
    }),
  );

  const { mutate: acceptRelease, isPending: isAccepting } = useMutation(
    api.cellar.member.acceptRelease.mutationOptions({
      onSuccess: (result) => {
        toast.success(`Accepted. We are arranging your delivery (order ${result.orderNumber}).`);
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
          `Condition report ${result.requestNumber} requested for ${result.cases} ${
            result.cases === 1 ? 'case' : 'cases'
          }: AED ${result.feeAed.toLocaleString('en-US')}.`,
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
  /* Wine at C&C's UK bond, from LCB's own report: part of the same collection */
  const { data: ukData } = useQuery(api.cellar.member.getUkHoldings.queryOptions());
  const hasUk = (ukData?.holdings.length ?? 0) > 0;

  const isUaeEmpty =
    !isLoading && wines.length === 0 && inbound.length === 0;
  const isEmptyCellar = isUaeEmpty && !hasUk;

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
      /*
        The indicative value: our list price where we list the wine, otherwise
        the price paid or recorded. UK wine counts only where we list it, since
        there is no paid figure to fall back on there.
      */
      indicative:
        wines.reduce(
          (sum, wine) => sum + bottlesOf(wine) * (wine.indicativePerBottle ?? 0),
          0,
        ) +
        (ukData?.holdings ?? []).reduce(
          (sum, holding) =>
            sum + (holding.totalBottles ?? 0) * (holding.indicativePerBottle ?? 0),
          0,
        ),
      isMemberValuation: wines.some((wine) => wine.indicativePerBottle !== undefined),
      inboundBottles: inbound.reduce(
        (sum, line) => sum + (line.totalBottles ?? 0),
        0,
      ),
    };
  }, [wines, inbound, ukData]);

  const handleExport = () => {
    const csvRows = [
      /*
        The export stays in dollars whatever the screen is showing, and says
        so in the header. A spreadsheet whose currency depends on a toggle
        somebody flicked before downloading it is a spreadsheet nobody can
        trust a month later.
      */
      totals.isMemberValuation
        ? ['Producer', 'Wine', 'Vintage', 'Size', 'Pack', 'Cases', 'Bottles', 'Indicative USD/btl', 'Basis']
        : ['Producer', 'Wine', 'Vintage', 'Size', 'Pack', 'Cases', 'Bottles', 'Import USD/btl'],
      ...wines.map((wine) => [
        wine.producer ?? '',
        wine.productName,
        wine.vintage ?? '',
        wine.bottleSize ?? '',
        wine.caseConfig ?? '',
        wine.totalCases,
        bottlesOf(wine),
        ...(totals.isMemberValuation
          ? [
              wine.indicativePerBottle ?? '',
              wine.indicativePerBottle
                ? wine.indicativeFromList
                  ? 'C&C list price'
                  : 'Price paid or recorded value'
                : '',
            ]
          : [wine.costPerBottle ?? '']),
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
  const td = 'px-3 py-2.5 align-middle text-[13px]';
  const tdMuted = `${td} text-text-muted`;

  /*
    The catalogue name repeats the vintage, size and strength that all have
    their own columns. Trimming the size alone left three formats of one wine
    reading identically, so the vintage goes too — what remains is the wine
    itself, and the columns say which bottle of it.
  */
  const displayName = displayWineName;

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
    <div className="w-full pb-8">
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {/*
            The same programme the member joined, named the same way. A portal
            that calls itself something else reads as a different product from
            the one they were sold.
          */}
          <Typography
            variant="bodyXs"
            className="text-text-muted mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em]"
          >
            C&amp;C Private Cellar
          </Typography>
          {/*
            No page title. The tab above already says "Your cellar", and
            repeating it cost a whole line of heading before a member saw a
            single bottle. The member's name earns its place; the word for the
            screen they are already on does not.
          */}
          <Typography variant="headingMd" className="block">
            {data?.partner?.name ?? '\u00A0'}
          </Typography>
          <Typography variant="bodyXs" colorRole="muted" className="mt-0.5 block">
            Stored duty-free in the C&amp;C bonded warehouse. Duty
            and VAT are only paid when wine is delivered to you in the UAE.
          </Typography>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
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
                className={`min-h-9 px-3 py-1.5 text-xs font-semibold transition-colors ${
                  currency === option
                    ? 'bg-text-primary text-surface-primary'
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
          {/* Monthly statements sit with the cellar they describe, not as a tab of their own */}
          <Link
            href="/platform/cellar/statement"
            className="border-border-muted text-text-primary hover:bg-fill-muted/40 inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold"
          >
            <IconFileText size={14} />
            Statements
          </Link>
        </div>
      </header>

      {/*
        Only what needs finishing sits above the wine. Transfers, bringing
        wine in and the membership follow the collection — the wine is the
        reason they are here — except for a new member with nothing stored
        yet, for whom they are the whole story.
      */}
      {isViewer && <ViewOnlyNotice />}
      <CellarOverviewPanel section="setup" readOnly={isViewer} />
      {isEmptyCellar && <CellarOverviewPanel section="details" readOnly={isViewer} />}
      {activationSheet}

      {/*
        Four cards in four unrelated pastels said nothing — the colours were
        chosen per card rather than meaning anything, so the eye got no help
        deciding which figure mattered. They are one neutral surface now, and
        the only card that colours itself is wine in transit, which colours
        itself only when there is some.
      */}
      {!isUaeEmpty && (
      <div
        className={`mb-4 grid grid-cols-2 gap-2 sm:gap-2.5 ${
          (inbound.length > 0 ? 1 : 0) + (totals.indicative > 0 ? 1 : 0) === 2
            ? 'sm:grid-cols-4'
            : (inbound.length > 0 ? 1 : 0) + (totals.indicative > 0 ? 1 : 0) === 1
              ? 'sm:grid-cols-3'
              : 'sm:grid-cols-2'
        }`}
      >
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
            value: money(totals.indicative),
            label: 'Indicative value',
            detail: 'a guide, not a valuation',
            alert: false,
          },
          {
            icon: IconShip,
            value: totals.inboundBottles.toLocaleString(),
            label: 'In transit',
            detail: `${inbound.length} ${inbound.length === 1 ? 'line' : 'lines'}`,
            alert: inbound.length > 0,
          },
        ]
          // In transit counts wine already on a shipment; a zero beside a transfer card contradicts it
          .filter((card) => card.label !== 'In transit' || inbound.length > 0)
          .filter((card) => card.label !== 'Indicative value' || totals.indicative > 0)
          .map((card) => (
          <div
            key={card.label}
            className={`rounded-xl border px-3 py-2 text-center ${
              card.alert
                ? 'border-amber-200 bg-amber-50/50'
                : 'border-border-muted bg-background-primary'
            }`}
          >
            <div
              className={`mx-auto mb-0.5 flex h-5 w-5 items-center justify-center rounded-md ${
                card.alert
                  ? 'bg-amber-100 text-amber-600'
                  : 'bg-emerald-50 text-emerald-600'
              }`}
            >
              <card.icon size={12} />
            </div>
            <div className="text-lg font-bold leading-tight tabular-nums">
              {card.value}
            </div>
            <div className="text-text-muted text-[11px]">{card.label}</div>
            <div className="text-text-muted text-[10px]">{card.detail}</div>
          </div>
        ))}
      </div>
      )}

      {!isUaeEmpty && totals.indicative > 0 && (
        <p className="text-text-muted -mt-2 mb-4 text-[11px] leading-4">
          Indicative value is based on Craft &amp; Culture&apos;s current list
          prices where we list the wine; otherwise the price you paid. A guide,
          not a valuation or an offer to buy.
        </p>
      )}

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
        <section className="border-border-muted mb-5 overflow-hidden rounded-xl border shadow-sm">
          <div className="flex items-center justify-between px-3 py-2">
            <Typography
              variant="bodyXs"
              className="text-text-primary flex items-center gap-1.5 font-semibold uppercase tracking-wider"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Delivery requests
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

              const isEditable =
                !isViewer &&
                ['draft', 'submitted', 'revision_requested'].includes(
                  request.status,
                );

              const isOpen = openRequestId === request.id;

              const lineFor = (itemId: string, fallback: number) =>
                editLines.get(itemId) ?? fallback;

              return (
                <div key={request.id}>
                <div
                  className={`flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between ${
                    needsDecision
                      ? 'bg-emerald-50/60'
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

                    {request.delivery?.isGift && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
                        Gift for {request.delivery.recipientName}
                      </span>
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
                        &middot; {money(request.totalCostUsd ?? 0)}
                      </Typography>
                    )}
                  </button>

                  {needsDecision && !isViewer && (
                    <div className="flex flex-shrink-0 items-center gap-1.5">
                      {/*
                        The ⓘ that used to stand in for the whole quote is
                        gone. It explained a single figure in prose; the panel
                        below now names every line with its own ⓘ, so keeping
                        it meant two explanations of the same thing, one of
                        them vaguer.
                      */}
                      <ConfirmAction
                        title="Accept these costs?"
                        description={
                          <>
                            <p>
                              We will prepare {request.requestNumber} for
                              delivery and arrange clearance. The quoted costs
                              are added to your next invoice.
                            </p>
                            <p>
                              Once accepted, changes are made by contacting us.
                            </p>
                          </>
                        }
                        confirmLabel="Accept and deliver"
                        onConfirm={() =>
                          acceptRelease({ requestId: request.id })
                        }
                      >
                        <Button
                          size="sm"
                          colorRole="primary"
                          className={DARK_ACTION}
                          isDisabled={isAccepting}
                        >
                          <ButtonContent>Accept and deliver</ButtonContent>
                        </Button>
                      </ConfirmAction>
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
                    {/*
                      Two columns once there is room for them. Stacked, each
                      row ran the full width of the screen with its label at one
                      end and its figure at the other, and a metre of nothing
                      between — the wine list and the costs are both narrow
                      things and the page is wide. Side by side they read as one
                      document: what is going, and what it costs.

                      Costs come first in the source so a phone shows the
                      decision before the detail, and move right on a desktop
                      where the eye starts at the list.
                    */}
                    <div className="mb-3 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-4">
                      <div className="mb-3 lg:order-2 lg:mb-0">
                    {/*
                          The quote, itemised. It was one figure behind an ⓘ, on
                          the reasoning that naming amounts publishes our rates and
                          invites a line-by-line negotiation. Bundling duty, VAT,
                          transfer and the distributor into a single clearance
                          figure keeps that true — no individual rate can be worked
                          back out of it — while still letting a member see what
                          they are actually paying for, and challenge a repack that
                          should not be there.
                        */}
                        {needsDecision && (
                          <div className="border-border-muted rounded-lg border px-3 py-2">
                            {/*
                              The wine's own value, above the rule and not in the
                              sum. It is what duty is assessed on, so a member
                              reading a duty figure has no way to judge it without
                              this — and every number below is reached from it.
                            */}
                            {(request.goodsValueUsd ?? 0) > 0 && (
                              <div className="bg-fill-muted/50 -mx-3 -mt-2 mb-2 flex items-start justify-between gap-3 px-3 py-2">
                                {/*
                                  On one line this wrapped in a 340px column and
                                  took the figure out of line with every figure
                                  below it, which is the one thing a column of
                                  money must not do. The qualifier sits under the
                                  label, where wrapping costs nothing.
                                */}
                                <Typography variant="bodyXs" colorRole="muted">
                                  Wine value
                                  <span className="block text-[10px] opacity-70">
                                    declared on import, not charged
                                  </span>
                                </Typography>
                                <Typography
                                  variant="bodyXs"
                                  colorRole="muted"
                                  className="tabular-nums"
                                >
                                  {money(request.goodsValueUsd ?? 0)}
                                </Typography>
                              </div>
                            )}
                            <dl className="flex flex-col gap-1">
                              {[
                                {
                                  label: 'Duty, VAT and clearance',
                                  value: request.clearanceCostUsd ?? 0,
                                  tip: 'Duty and VAT at the rates UAE customs sets, plus moving the wine out of the free zone and the licensed partner who delivers it.',
                                },
                                {
                                  label: 'Delivery',
                                  value: request.deliveryCostUsd ?? 0,
                                  tip: 'The drive to your address.',
                                },
                                ...(request.repackCostUsd
                                  ? [
                                      {
                                        label: `Repacking${request.repackCases ? ` · ${request.repackCases} ${request.repackCases === 1 ? 'case' : 'cases'}` : ''}`,
                                        value: request.repackCostUsd,
                                        tip: `Part of a sealed case means opening it, checking the bottles, boxing what you are taking and relabelling the rest. Charged per case opened, not per bottle. Whole cases are free of it.`,
                                      },
                                    ]
                                  : []),
                                ...(request.additionalChargeUsd
                                  ? [
                                      {
                                        label:
                                          request.additionalChargeLabel ??
                                          'Additional charge',
                                        value: request.additionalChargeUsd,
                                        tip: null,
                                      },
                                    ]
                                  : []),
                                {
                                  label: 'C&C platform fee',
                                  value: request.serviceFeeUsd ?? 0,
                                  tip: 'Our fee for arranging the delivery: paperwork, customs filing and the distributor.',
                                },
                              ].map((line) => (
                                <div
                                  key={line.label}
                                  className="flex items-baseline justify-between gap-3"
                                >
                                  <dt className="text-text-muted inline-flex items-center gap-1 text-xs">
                                    {line.label}
                                    {line.tip && (
                                      <Tooltip>
                                        <TooltipTrigger
                                          aria-label={`Why ${line.label} is charged`}
                                        >
                                          <Icon
                                            icon={IconInfoCircle}
                                            size="xs"
                                            colorRole="muted"
                                          />
                                        </TooltipTrigger>
                                        <TooltipContent
                                          side="top"
                                          className="max-w-[300px] text-left lg:max-w-[300px]"
                                        >
                                          <Typography variant="bodyXs">
                                            {line.tip}
                                          </Typography>
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                  </dt>
                                  <dd className="text-text-primary m-0 text-xs tabular-nums">
                                    {money(line.value)}
                                  </dd>
                                </div>
                              ))}

                              {/*
                                The figure being agreed to, set apart from the
                                lines that make it. At the same size as its own
                                components it read as a fifth charge rather than
                                their sum.
                              */}
                              <div className="border-border-muted mt-2 flex items-baseline justify-between gap-3 border-t pt-2">
                                <dt className="text-text-primary text-xs font-semibold">
                                  Total to deliver
                                </dt>
                                <dd className="text-text-primary m-0 text-base font-bold tabular-nums">
                                  {money(request.totalCostUsd ?? 0)}
                                </dd>
                              </div>
                            </dl>
                            <Typography
                              variant="bodyXs"
                              colorRole="muted"
                              className="mt-2 block text-[11px] opacity-80"
                            >
                              You already own the wine. Nothing further is added.
                            </Typography>
                          </div>
                        )}

                      </div>

                      <div className="lg:order-1">
                        <div className="border-border-muted overflow-hidden rounded-lg border">
                          <table className="w-full text-xs">
                            <tbody className="divide-border-muted/60 divide-y">
                              {request.items.map((item) => {
                                const bottles = lineFor(item.id, item.bottles);

                                return (
                                  <tr key={item.id}>
                                    <td className="px-3 py-1.5">
                                      {lineLabel(
                                        item.productName,
                                        item.vintage,
                                        item.bottleSize,
                                        item.caseConfig,
                                      )}
                                    </td>
                                    {/*
                                      Its own column. Run on after the format
                                      the lot read as part of the wine's name,
                                      and seven of them at seven different
                                      horizontal positions gave the eye nothing
                                      to follow — which is the whole use of a
                                      lot number, checking it against what is on
                                      the shelf.
                                    */}
                                    <td className="text-text-muted hidden whitespace-nowrap px-3 py-1.5 font-mono text-[11px] sm:table-cell">
                                      {item.lotNumber ?? '—'}
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
                      </div>
                    </div>

                    {isEditable ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          colorRole="primary"
                        className={DARK_ACTION}
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
                        <ConfirmAction
                          title="Withdraw this delivery request?"
                          description={
                            <p>
                              {request.requestNumber} will be closed and your
                              wine stays in your private cellar. You can
                              request a delivery again at any time.
                            </p>
                          }
                          confirmLabel="Withdraw request"
                          tone="danger"
                          onConfirm={() =>
                            withdrawRelease({ requestId: request.id })
                          }
                        >
                          <Button
                            size="sm"
                            variant="outline"
                            isDisabled={isWithdrawing}
                          >
                            <ButtonContent>Withdraw request</ButtonContent>
                          </Button>
                        </ConfirmAction>
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

      <DeliveriesPanel requests={releaseData?.requests ?? []} section="live" />

      {isEmptyCellar ? (
        /*
          A new member has nothing held yet. Four zero tiles, a search box and
          an empty table said so four times; one card says it once and points
          somewhere useful.
        */
        <div className="border-border-muted rounded-xl border bg-gradient-to-b from-slate-50/70 to-transparent px-6 py-12 text-center dark:from-slate-500/10">
          <span className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-500/20">
            <IconBottle size={20} />
          </span>
          <p className="text-text-primary text-base font-semibold">
            Your cellar is empty for now
          </p>
          <p className="text-text-muted mx-auto mt-1 max-w-md text-sm leading-6">
            Your wines will appear here as soon as they arrive in our warehouse. In the
            meantime, you can browse what we hold today, or tell us about wine
            you would like to bring in.
          </p>
          <Link
            href="/platform/cellar/available"
            className="bg-text-primary text-surface-primary mt-5 inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold"
          >
            Browse The Cellar List
          </Link>
        </div>
      ) : isUaeEmpty ? null : (
        <>
      {hasUk && (
        <p className="text-text-primary mb-2 text-sm font-semibold">
          United Arab Emirates · C&amp;C bonded warehouse
        </p>
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
            className={`inline-flex h-9 flex-shrink-0 items-center whitespace-nowrap rounded-full px-3.5 text-xs font-semibold transition-colors ${
              quickFilter === filter.key
                ? 'bg-text-primary text-surface-primary'
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
              {/*
                The definition sits on the thing it defines. As a glossary at
                the foot of the page it was three sentences nobody reached,
                explaining labels they had already stopped wondering about.
              */}
              <th className={`${th} hidden text-right lg:table-cell`}>
                <Tooltip>
                  <TooltipTrigger className="inline-flex items-center gap-1">
                    {currency === 'AED' ? 'AED' : '$'} / btl
                    <Icon icon={IconInfoCircle} size="xs" colorRole="muted" />
                  </TooltipTrigger>
                  <TooltipContent
                    side="left"
                    className="max-w-[220px] text-left lg:max-w-[220px]"
                  >
                    <Typography variant="bodyXs">
                      {totals.isMemberValuation
                        ? 'Indicative value: Craft & Culture’s current list price where we list the wine; otherwise the price you paid (marked *). A guide, not a valuation or an offer to buy.'
                        : 'The value declared when the wine was brought into bond. Not a market valuation.'}
                    </Typography>
                  </TooltipContent>
                </Tooltip>
              </th>
              {/*
                Two columns, two headers. Repeating the verb on every row was
                worse than the header had been — the problem was that the label
                sat a long way from the buttons, not that it was missing. A
                column header solves both: said once, directly above its own
                controls.
              */}
              <th className={`${th} text-right sm:w-[168px] sm:min-w-[168px]`}>Deliver</th>
              <th className={`${th} text-right sm:w-[76px] sm:min-w-[76px]`}>Sell</th>
            </tr>
          </thead>
          <tbody className="divide-border-muted divide-y">
            {isLoading && (
              <tr>
                <td colSpan={11} className="text-text-muted px-3 py-8 text-center">
                  Loading your cellar&hellip;
                </td>
              </tr>
            )}

            {!isLoading && !rows.length && (
              <tr>
                <td colSpan={11} className="text-text-muted px-3 py-10 text-center">
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
                        ? 'bg-emerald-50/50 shadow-[inset_2px_0_0_0] shadow-emerald-500 dark:bg-emerald-500/10'
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
                      {wine.indicativePerBottle !== undefined ? (
                        wine.indicativePerBottle ? (
                          <>
                            {money(wine.indicativePerBottle, true)}
                            {!wine.indicativeFromList && (
                              <span
                                className="text-text-muted ml-0.5"
                                title="Not on our list: the price you paid, or the value recorded"
                              >
                                *
                              </span>
                            )}
                          </>
                        ) : (
                          '—'
                        )
                      ) : wine.costPerBottle ? (
                        money(wine.costPerBottle, true)
                      ) : (
                        '—'
                      )}
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
                        if (isViewer) return null;

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
                                className="text-text-muted hover:bg-fill-muted hover:text-text-primary h-9 w-9 rounded transition-colors sm:h-6 sm:w-6"
                              >
                                &minus;
                              </button>
                              <span className="text-text-primary min-w-[46px] text-center text-xs font-semibold tabular-nums">
                                {chosen} of {held}
                              </span>
                              <button
                                type="button"
                                aria-label={`One more bottle of ${wine.productName}`}
                                disabled={chosen >= held}
                                onClick={() => addToWine(wine, 1)}
                                className="text-text-muted hover:bg-fill-muted hover:text-text-primary h-9 w-9 rounded transition-colors disabled:opacity-30 sm:h-6 sm:w-6"
                              >
                                +
                              </button>
                              {pack > 1 && chosen + pack <= held && (
                                <button
                                  type="button"
                                  onClick={() => addToWine(wine, pack)}
                                  className="text-text-muted hover:bg-fill-muted hover:text-text-primary ml-0.5 rounded px-1.5 py-1 text-[11px] font-medium transition-colors"
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
                          <span className="inline-flex items-center justify-end gap-0.5 opacity-100 transition-opacity sm:opacity-60 sm:group-hover:opacity-100">
                            {/*
                              Fixed width and no wrapping. The labels were
                              breaking mid-word into "+" over "Case", which
                              made rows different heights, and "+ Bottle" sat
                              in a different place depending on whether the row
                              had a case button beside it — so the eye had to
                              find the control again on every line.
                            */}
                            {pack > 1 && (
                              <button
                                type="button"
                                onClick={() => addToWine(wine, pack)}
                                className="hover:bg-fill-muted hover:text-text-primary text-text-muted min-h-9 whitespace-nowrap rounded px-2 py-1 text-xs font-medium transition-colors sm:min-h-0"
                              >
                                + Case
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => addToWine(wine, 1)}
                              className="hover:bg-fill-muted hover:text-text-primary text-text-muted min-h-9 whitespace-nowrap rounded px-2 py-1 text-xs font-medium transition-colors sm:min-h-0 sm:w-[68px]"
                            >
                              + Bottle
                            </button>
                          </span>
                        );
                      })()}
                    </td>

                    {/*
                      Selling is its own column, under its own header. It sits
                      beside drinking because they are the only two things a
                      member can do, but they are different verbs and a shared
                      cell made the eye parse three links to find which was
                      which.
                    */}
                    <td
                      className={`${td} text-right`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {!isViewer && (
                      <button
                        type="button"
                        onClick={() => {
                          setSellingWine(wine);
                          setSellLines(new Map());
                          setSellAsk('');
                        }}
                        className="whitespace-nowrap rounded px-2 py-1 text-xs font-semibold text-emerald-700 opacity-100 transition-all hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10 sm:opacity-60 sm:group-hover:opacity-100"
                      >
                        Sell
                      </button>
                      )}
                    </td>
                  </tr>

                  {/*
                    A panel, not more table. Tinting the row was not enough —
                    the nested tables have their own headers and rules, so at
                    the same width and inset as the cellar they read as a
                    continuation of it rather than as detail belonging to one
                    wine. A border, a ground and an inset say whose they are.
                  */}
                  {isOpen && (
                    <tr className="bg-fill-muted/50 shadow-[inset_3px_0_0_0] shadow-emerald-400">
                      <td colSpan={11} className="px-3 py-3 sm:px-6 sm:py-4">
                        <div className="border-border-muted bg-background-primary rounded-xl border px-3.5 py-3.5 shadow-sm">
                        {/*
                          One line per parcel actually held. A wine received on
                          two occasions is two holdings with two histories, and
                          collapsing them to a single total is the warehouse's
                          convenience rather than the owner's record.
                        */}
                        <Typography
                          variant="bodyXs"
                          className="text-text-muted mb-1.5 block text-[10px] font-semibold uppercase tracking-wider"
                        >
                          <span className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-emerald-400 align-middle" />
                          Cases held
                        </Typography>

                        {/*
                          Sized to its content, not to the screen. Stretched to
                          full width, seven columns and one parcel put the
                          release stepper more than a thousand pixels from the
                          lot it acts on — and left this table looking nothing
                          like the movement history directly beneath it, which
                          has always sized to its own content.
                        */}
                        <div className="border-border-muted bg-background-primary inline-block max-w-full overflow-x-auto rounded-lg border align-top">
                          <table className="w-auto text-xs">
                            <thead>
                              <tr className="text-text-muted border-border-muted border-b text-[11px] uppercase tracking-wider">
                                <th className="whitespace-nowrap px-3 py-1.5 text-right">Cases</th>
                                <th className="whitespace-nowrap px-3 py-1.5 text-center">Pack</th>
                                <th className="whitespace-nowrap px-3 py-1.5 text-right">Bottles</th>
                                <th className="hidden whitespace-nowrap px-3 py-1.5 text-left sm:table-cell">
                                  Lot
                                </th>
                                <th className="whitespace-nowrap px-3 py-1.5 text-left">Stored since</th>
                                <th className="whitespace-nowrap px-3 py-1.5 text-left">Status</th>
                                <th className="whitespace-nowrap px-3 py-1.5 text-right">
                                  Deliver
                                </th>
                                <th className="px-4 py-1.5 text-right" />
                              </tr>
                            </thead>
                            <tbody className="divide-border-muted/60 divide-y">
                              {wine.locations.map((parcel) => (
                                <tr
                                  key={parcel.stockId}
                                >
                                  <td className="whitespace-nowrap px-3 py-1.5 text-right font-semibold tabular-nums">
                                    {parcel.quantityCases}
                                  </td>
                                  <td className="text-text-muted whitespace-nowrap px-3 py-1.5 text-center tabular-nums">
                                    {wine.caseConfig ?? 1} &times;{' '}
                                    {wine.bottleSize ?? '75cl'}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                                    {parcel.quantityCases * (wine.caseConfig ?? 1)}
                                  </td>
                                  <td className="text-text-muted hidden whitespace-nowrap px-3 py-1.5 font-mono text-xs sm:table-cell">
                                    {parcel.lotNumber ?? '—'}
                                  </td>
                                  <td className="text-text-muted whitespace-nowrap px-3 py-1.5">
                                    {parcel.receivedAt
                                      ? format(
                                          new Date(parcel.receivedAt),
                                          'MMM yyyy',
                                        )
                                      : '—'}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-1.5">
                                    {parcel.reservedCases > 0 ? (
                                      <span
                                        title="Committed against an order already placed"
                                        className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700"
                                      >
                                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                        {parcel.reservedCases} allocated
                                      </span>
                                    ) : (
                                      <span
                                        title="Stored duty-free in our bonded warehouse"
                                        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
                                      >
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                        In storage
                                      </span>
                                    )}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-1.5 text-right">
                                    {(() => {
                                      const inBasket = basket.get(parcel.stockId) ?? 0;
                                      const pack = wine.caseConfig ?? 1;
                                      const held = parcel.quantityCases * pack;

                                      if (isViewer) return null;

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
                                              className="border-border-muted hover:bg-fill-muted hover:text-text-primary mr-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-40"
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
                                  <td className="whitespace-nowrap px-3 py-1.5 text-right">
                                    {(() => {
                                      const open = requestByStock.get(parcel.stockId);

                                      if (isViewer && !open) return null;

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
                                          <ConfirmAction
                                            title="Request a condition report?"
                                            description={
                                              <p>
                                                We inspect every bottle for fill
                                                level, label, capsule and
                                                closure, and report with
                                                photographs and written notes.
                                                AED {CONDITION_REPORT_FEE_AED}{' '}
                                                per case, so AED{' '}
                                                {(
                                                  CONDITION_REPORT_FEE_AED *
                                                  parcel.quantityCases
                                                ).toLocaleString('en-US')}{' '}
                                                for{' '}
                                                {parcel.quantityCases === 1
                                                  ? 'this case'
                                                  : `these ${parcel.quantityCases} cases`}
                                                , added to your next invoice.
                                              </p>
                                            }
                                            confirmLabel="Request report"
                                            onConfirm={() =>
                                              requestReport({
                                                stockId: parcel.stockId,
                                              })
                                            }
                                          >
                                            <button
                                              type="button"
                                              disabled={isRequesting}
                                              onClick={(event) =>
                                                event.stopPropagation()
                                              }
                                              className="text-text-primary hover:bg-fill-muted -my-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                                            >
                                              Request condition report
                                            </button>
                                          </ConfirmAction>
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
                                                <strong>
                                                  AED {CONDITION_REPORT_FEE_AED}{' '}
                                                  per case
                                                </strong>
                                                . We inspect every bottle for
                                                fill level, label, capsule and
                                                closure, and report with
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
                          <div className="border-border-muted mt-4 border-t pt-3.5">
                            <div className="mb-2 flex items-center gap-1.5">
                              <Icon
                                icon={IconHistory}
                                size="xs"
                                className="text-text-muted"
                              />
                              <Typography
                                variant="bodyXs"
                                className="text-text-muted text-[10px] font-semibold uppercase tracking-wider"
                              >
                                <span className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-emerald-400/60 align-middle" />
                                Movement history
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
                              <table className="w-auto text-xs">
                                <thead>
                                  <tr className="text-text-muted border-border-muted border-b text-[11px] uppercase tracking-wider">
                                    <th className="whitespace-nowrap px-3 py-1.5 text-left">
                                      When
                                    </th>
                                    <th className="whitespace-nowrap px-3 py-1.5 text-left">
                                      Type
                                    </th>
                                    <th className="whitespace-nowrap px-3 py-1.5 text-right">
                                      Cases
                                    </th>
                                    <th className="whitespace-nowrap px-3 py-1.5 text-left">
                                      Reference
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-border-muted/60 divide-y">
                                  {history.map((movement) => (
                                    <tr key={movement.id}>
                                      <td className="text-text-muted whitespace-nowrap px-3 py-1.5">
                                        {movement.performedAt
                                          ? format(
                                              new Date(movement.performedAt),
                                              'd MMM yyyy',
                                            )
                                          : '—'}
                                      </td>
                                      <td className="whitespace-nowrap px-3 py-1.5">
                                        <MovementTypeBadge
                                          movementType={
                                            movement.movementType as MovementTypeBadgeProps['movementType']
                                          }
                                          size="sm"
                                        />
                                      </td>
                                      <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                                        {movement.quantityCases ?? '—'}
                                      </td>
                                      <td className="text-text-muted whitespace-nowrap px-3 py-1.5 font-mono text-xs">
                                        {movement.movementNumber ?? '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
        </>
      )}

      {ukData && (
        <UkHoldingsPanel
          data={ukData}
          formatValue={(usd) => money(usd, true)}
          readOnly={isViewer}
        />
      )}

      <DeliveriesPanel requests={releaseData?.requests ?? []} section="past" />

      {!isEmptyCellar && (
        <div className="mt-8">
          <CellarOverviewPanel section="details" readOnly={isViewer} />
        </div>
      )}

      {basket.size > 0 && (
        <div className="border-border-muted bg-background-primary sticky bottom-3 z-20 mt-6 overflow-hidden rounded-xl border shadow-xl">
          <div className="h-1 bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-200" />
          <div className="p-3 sm:p-4">
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
                        className="text-text-primary font-semibold uppercase tracking-wider"
                      >
                        Delivery request
                      </Typography>
                      <Typography variant="bodySm" className="font-semibold">
                        {bottles} {bottles === 1 ? 'bottle' : 'bottles'} from{' '}
                        {wineCount} {wineCount === 1 ? 'wine' : 'wines'}
                      </Typography>
                      {estimate?.priced && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1">
                          <Typography
                            variant="bodyXs"
                            className="font-semibold text-emerald-800"
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
                                className="text-emerald-700"
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
                                  delivering it to you.
                                </Typography>
                                <Typography variant="bodyXs">
                                  Duty, VAT, customs clearance, licensed
                                  delivery to your address, and our handling.
                                </Typography>
                                <Typography variant="bodyXs" colorRole="muted">
                                  Duty follows the declared value, so a finer
                                  case costs more to deliver. We confirm the
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
                    <div className="flex w-full flex-shrink-0 items-center gap-2 sm:w-auto">
                      <Button
                        size="sm"
                        colorRole="primary"
                        className={`${DARK_ACTION} flex-1 sm:flex-none`}
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
              <div className="sm:col-span-2">
                <DeliveryOptionsForm
                  addresses={savedAddresses}
                  value={deliveryChoice}
                  onChange={setDeliveryChoice}
                />
              </div>
              <label className="block sm:col-span-2">
                <span className="text-text-muted mb-1 block text-[11px] font-semibold uppercase tracking-wider">
                  Notes for our team &mdash; optional
                </span>
                <Input
                  value={memberNotes}
                  onChange={(event) => setMemberNotes(event.target.value)}
                  placeholder="Anything else we should know"
                />
              </label>
            </div>
            <div
              className={`flex flex-wrap items-center gap-2 ${isBasketOpen ? '' : 'hidden'}`}
            >
              <Button
                size="sm"
                colorRole="primary"
                        className={DARK_ACTION}
                isDisabled={isSaving || isSavingAddress}
                onClick={async () => {
                  const choice = deliveryChoice;
                  const isTyping =
                    choice.isNew || savedAddresses.length === 0;
                  const chosen = isTyping
                    ? undefined
                    : (savedAddresses.find(
                        (saved) => saved.id === choice.addressId,
                      ) ??
                      savedAddresses.find((saved) => saved.isDefault) ??
                      savedAddresses[0]);

                  if (isTyping && choice.newAddress.trim().length < 5) {
                    toast.error('Enter the address for this delivery.');
                    return;
                  }

                  if (
                    choice.isGift &&
                    (choice.recipientName.trim().length < 2 ||
                      choice.recipientPhone.trim().length < 7)
                  ) {
                    toast.error(
                      'Add the name and mobile of the person receiving the wine.',
                    );
                    return;
                  }

                  /*
                    A new address is saved first, so the request can point at
                    it. If saving fails the delivery still goes ahead with the
                    address as typed — losing the request over the address book
                    would be the wrong way round.
                  */
                  let addressId = chosen?.id ?? null;

                  if (isTyping && choice.saveNew) {
                    try {
                      const saved = await saveAddress({
                        label:
                          choice.newLabel.trim() ||
                          (choice.isGift
                            ? choice.recipientName.trim() || 'Gift'
                            : savedAddresses.length === 0
                              ? 'Home'
                              : 'Other'),
                        address: choice.newAddress.trim(),
                        instructions: choice.newInstructions.trim() || null,
                      });

                      addressId = saved.id;
                    } catch {
                      addressId = null;
                    }
                  }

                  saveRelease({
                    deliveryAddress: isTyping
                      ? choice.newAddress.trim()
                      : chosen?.address || undefined,
                    memberNotes: memberNotes || undefined,
                    delivery: {
                      addressId,
                      deliveryInstructions: isTyping
                        ? choice.newInstructions.trim() || null
                        : (chosen?.instructions ?? null),
                      preferredDate: choice.preferredDate || null,
                      preferredWindow: choice.preferredWindow,
                      gift: choice.isGift
                        ? {
                            recipientName: choice.recipientName.trim(),
                            recipientPhone: choice.recipientPhone.trim(),
                            message: choice.giftMessage.trim() || null,
                          }
                        : null,
                    },
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
                We send you the costs for approval before any wine leaves
                our warehouse.
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
            <>
              <Typography
                variant="bodyXs"
                colorRole="muted"
                className="mt-0.5 block"
              >
                {profile.deliveryAddress}
              </Typography>
              {/*
                A licensed delivery cannot be made without it, so it is a
                blocker rather than a detail mentioned in passing.
              */}
              {profile.documents.length === 0 && (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  No ID on file &mdash; needed before we can deliver
                </span>
              )}
            </>
          ) : (
            <Typography variant="bodyXs" colorRole="muted" className="mt-0.5 block">
              No delivery address yet. Add one and it will be filled in
              whenever you request a delivery.
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
        Selling is a dialog rather than an expanding row. It is one decision
        about one wine, it carries a warning the member has to read, and it
        should not be something they scroll past while looking at something
        else.
      */}
      <Dialog
        open={Boolean(sellingWine)}
        onOpenChange={(open) => {
          if (!open) setSellingWine(null);
        }}
      >
        <DialogContent className="max-w-lg">
          {sellingWine && (
            <>
              <DialogHeader>
                <DialogTitle>Sell this wine</DialogTitle>
                <DialogDescription>
                  {displayName(sellingWine.productName)}
                  {sellingWine.vintage ? ` · ${sellingWine.vintage}` : ''}
                  {sellingWine.bottleSize
                    ? ` · ${sellingWine.caseConfig && sellingWine.caseConfig > 1 ? `${sellingWine.caseConfig}×` : ''}${sellingWine.bottleSize}`
                    : ''}
                </DialogDescription>
              </DialogHeader>

              {(() => {
                const pack = sellingWine.caseConfig ?? 1;

                const chosen = [...sellLines.values()].reduce(
                  (sum, count) => sum + count,
                  0,
                );

                const ask = Math.max(0, Number(sellAsk) || 0);
                /*
                  The ask is what the member receives. The shelf price is the
                  ask with commission added on top, not taken out of it — the
                  second reading makes a member feel short-changed by a number
                  they chose themselves.
                */
                const listed = ask > 0 ? ask / (1 - 2.5 / 100) : 0;
                const listedPc = ask > 0 ? ask / (1 - 30 / 100) : 0;

                return (
                  <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto px-4 py-4">
                    <div className="border-border-muted overflow-hidden rounded-lg border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-text-muted border-border-muted border-b text-[10px] uppercase tracking-wider">
                            <th className="px-3 py-1.5 text-left">Lot</th>
                            <th className="px-3 py-1.5 text-right">Available</th>
                            <th className="px-3 py-1.5 text-right">Offering</th>
                          </tr>
                        </thead>
                        <tbody className="divide-border-muted/60 divide-y">
                          {sellingWine.locations.map((parcel) => {
                            /* Less anything already on an open offer or delivery, as the server counts it */
                            const available = Math.max(
                              0,
                              parcel.availableCases * pack -
                                parcel.claimedBottles,
                            );
                            const offering = sellLines.get(parcel.stockId) ?? 0;

                            return (
                              <tr key={parcel.stockId}>
                                <td className="px-3 py-2">
                                  <span className="text-text-muted font-mono text-xs">
                                    {parcel.lotNumber ?? 'no lot'}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {available}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <input
                                    type="number"
                                    min={0}
                                    max={available}
                                    value={offering || ''}
                                    placeholder="0"
                                    onChange={(event) => {
                                      const wanted = Math.max(
                                        0,
                                        Math.min(
                                          available,
                                          Number(event.target.value) || 0,
                                        ),
                                      );

                                      setSellLines((current) => {
                                        const next = new Map(current);
                                        if (wanted > 0)
                                          next.set(parcel.stockId, wanted);
                                        else next.delete(parcel.stockId);
                                        return next;
                                      });
                                    }}
                                    className="border-border-muted bg-background-primary h-8 w-20 rounded-md border px-2 text-right text-sm tabular-nums"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <label className="block">
                      <span className="text-text-muted mb-1 block text-[11px] font-semibold uppercase tracking-wider">
                        Your price per bottle
                      </span>
                      <Input
                        value={sellAsk}
                        onChange={(event) => setSellAsk(event.target.value)}
                        placeholder="0.00"
                      />
                    </label>

                    {ask > 0 && chosen > 0 && (
                      <dl className="border-border-muted flex flex-col gap-1 rounded-lg border px-3 py-2.5 text-sm">
                        <div className="flex justify-between">
                          <dt className="font-semibold">You receive</dt>
                          <dd className="font-semibold tabular-nums">
                            {money(ask * chosen)}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-text-muted text-xs">
                            Listed to trade
                          </dt>
                          <dd className="text-text-muted text-xs tabular-nums">
                            {money(listed)} a bottle
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-text-muted text-xs">
                            Listed to private clients
                          </dt>
                          <dd className="text-text-muted text-xs tabular-nums">
                            {money(listedPc)} a bottle
                          </dd>
                        </div>
                      </dl>
                    )}

                    {/*
                      The member's point of no return is this button, not the
                      placement — which they neither see coming nor control. It
                      has to be said here, before they press it.
                    */}
                    <div className="rounded-lg bg-amber-50 px-3 py-2.5">
                      <Typography
                        variant="bodyXs"
                        className="block leading-relaxed text-amber-900"
                      >
                        <strong>This cannot always be taken back.</strong> You
                        may withdraw while the wine is still with us. If we
                        place it with a distributor to sell it (our decision,
                        not yours), it leaves our warehouse and can no longer
                        be withdrawn.{' '}
                        <a
                          href="/legal/private-cellar-terms"
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold underline"
                        >
                          Private Cellar terms
                        </a>
                      </Typography>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        colorRole="primary"
                        className={DARK_ACTION}
                        isDisabled={isOffering || chosen === 0 || ask <= 0}
                        onClick={() =>
                          offerForSale({
                            lines: [...sellLines.entries()].map(
                              ([stockId, bottles]) => ({ stockId, bottles }),
                            ),
                            askPerBottleUsd: ask,
                          })
                        }
                      >
                        <ButtonContent>
                          {chosen > 0
                            ? `Offer ${chosen} ${chosen === 1 ? 'bottle' : 'bottles'} to C&C`
                            : 'Offer to C&C'}
                        </ButtonContent>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setSellingWine(null)}
                      >
                        <ButtonContent>Cancel</ButtonContent>
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CellarPage;
