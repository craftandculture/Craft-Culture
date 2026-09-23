'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import formatBottles from '@/app/_triangulation/utils/formatBottles';
import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import CodeLinkPanel from './CodeLinkPanel';
import SalesUpload from './SalesUpload';
import StatementPanel from './StatementPanel';
import ownerColour from '../utils/ownerColour';


/** Money as the document states it, with no currency assumed */
const formatValue = (value: number, currency: string | null) => {
  const amount = new Intl.NumberFormat('en-GB', {
    maximumFractionDigits: 0,
  }).format(value);

  return currency ? `${currency} ${amount}` : amount;
};

const formatWhen = (value: Date | string | null) => {
  if (!value) return 'never';

  const when = new Date(value);
  const hours = (Date.now() - when.getTime()) / 36e5;

  if (hours < 24) return `${Math.round(hours)}h ago`;

  return `${Math.round(hours / 24)}d ago`;
};

/**
 * Distribution — what went out, and what the outlet holds
 *
 * Deliberately one screen. The tool this replaces ran to six tabs and fifty
 * endpoints for a job that is four numbers per wine, and the reading of it
 * suffered for the reach.
 *
 * What is consigned comes from our invoice tags and never from the
 * distributor's own status field. Theirs is a record of our commercial
 * relationship kept by someone else, and it is wrong often enough to matter:
 * Tignanello 2022 was invoiced to City Drinks as an outright sale and their
 * feed still flags it Consigned. Lines of theirs that match no consignment of
 * ours are not shown at all — they are their stock, whatever they call it.
 *
 * Sold is out less what they hold, so it falls as their feed depletes. Billed
 * still needs the owner's bill. Showing that as zero would read as nothing
 * having been billed, which is a different claim from not yet knowing.
 */
const DistributionClient = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const [outletId, setOutletId] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<
    'live' | 'all' | 'attention' | 'holding' | 'empty' | 'unknown' | 'theirs' | 'closed'
  >('live');

  const setup = useQuery(api.distribution.admin.getSetup.queryOptions());

  // Land on the first outlet once they arrive, rather than an empty screen
  useEffect(() => {
    if (!outletId && setup.data?.outlets.length) {
      setOutletId(setup.data.outlets[0]!.id);
    }
  }, [setup.data, outletId]);

  const balances = useQuery({
    ...api.distribution.admin.getBalances.queryOptions({
      outletId: outletId ?? '',
      ownerId: ownerId || null,
      search: search.trim() || undefined,
    }),
    enabled: Boolean(outletId),
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: api.distribution.admin.getSetup.queryKey(),
    });
    await queryClient.invalidateQueries({
      queryKey: api.distribution.admin.getBalances.queryKey(),
    });
  };

  const pull = useMutation({
    ...api.distribution.admin.pullOutletStock.mutationOptions(),
    onSuccess: async (result) => {
      for (const outcome of result.results) {
        if (!outcome.ok) {
          toast.error(`${outcome.outlet}: ${outcome.reason}`);
          continue;
        }

        toast.success(
          `${outcome.outlet} — ${outcome.consigned} consigned lines, ${formatBottles(outcome.consignedBottles)} bottles`,
        );
      }

      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  /*
    Said by hand, and believed ever after. Applied on the next read of the
    invoices, which is why the toast says to run one.
  */
  const [bulkRef, setBulkRef] = useState('');
  const [bulkOwner, setBulkOwner] = useState('');

  const setInvoiceOwner = useMutation(
    api.distribution.admin.setInvoiceOwner.mutationOptions({
      onSuccess: async (result) => {
        toast.success(
          `${result.wines} wines on ${result.docRef} set — read the invoices to apply it`,
        );
        await invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  /*
    A line they buy is not a consignment position. Their stock of it answers to
    nobody here, so it leaves the totals rather than inflating them.
  */
  const setClosed = useMutation(
    api.distribution.admin.setWineClosed.mutationOptions({
      onSuccess: async (result) => {
        toast.success(
          result.closed
            ? 'Closed — it returns if they hold it again or you send more'
            : 'Back on the live view',
        );
        await invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const setBought = useMutation(
    api.distribution.admin.setWineBought.mutationOptions({
      onSuccess: async (result) => {
        toast.success(
          result.bought
            ? 'Marked as a line they buy — out of the consignment totals'
            : 'Back on consignment',
        );
        await invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const setOwner = useMutation(
    api.distribution.admin.setWineOwner.mutationOptions({
      onSuccess: async () => {
        toast.success('Owner recorded — read the invoices to apply it');
        await invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const syncOut = useMutation({
    ...api.distribution.admin.syncOutFromZoho.mutationOptions(),
    onSuccess: async (result) => {
      toast.success(
        `${result.invoicesTaken} consignment invoices · ${result.lines} lines · ${formatBottles(result.bottles)} bottles · ${result.headerRowsSeen} owner headers in ${result.lineRowsSeen} rows`,
      );

      if (result.unattributed.length > 0) {
        toast.warning(
          `${result.unattributed.length} lines could not be attributed to an owner`,
        );
      }

      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const outlet = setup.data?.outlets.find((row) => row.id === outletId);
  /** Narrowed to one owner or a search — so the totals are a slice, not the whole */
  const isFiltered = Boolean(ownerId || search.trim());

  /*
    Colour is keyed on the owner's place in this list, so it is stable while
    the list is and nobody changes colour because someone else was renamed.
  */
  const colourOf = (id: string) =>
    ownerColour(setup.data?.owners.findIndex((row) => row.id === id) ?? -1);
  const allRows = balances.data?.rows ?? [];
  const summary = balances.data?.summary;

  /** Out less what they hold — what has left their shelf, or null if unknown */
  const goneOf = (row: (typeof allRows)[number]) =>
    row.heldDeclared === null ? null : row.outBottles - row.heldDeclared;

  /*
    What the depleted bottles were invoiced at. The rate comes from the row's
    own Out value rather than a price list, so it is what we actually billed
    for these bottles and reconciles against the invoice by construction.
    Unknown position means unknown depletion — not nil.
  */
  const soldValueOf = (row: (typeof allRows)[number]) => {
    const gone = goneOf(row);

    if (gone === null || row.outBottles <= 0 || row.outValue <= 0) return null;

    return gone * (row.outValue / row.outBottles);
  };

  const soldValueTotal = allRows.reduce(
    (total, row) => total + (soldValueOf(row) ?? 0),
    0,
  );

  /*
    Four questions, each a different kind of work. A hundred and sixty-seven
    rows sorted by size buries the three that are actually wrong, and those are
    the only ones anybody can act on today.
  */
  const views = {
    attention: (row: (typeof allRows)[number]) =>
      (goneOf(row) ?? 0) < 0 || row.packAssumed,
    holding: (row: (typeof allRows)[number]) => (row.heldDeclared ?? 0) > 0,
    empty: (row: (typeof allRows)[number]) => row.heldDeclared === 0,
    unknown: (row: (typeof allRows)[number]) => row.heldDeclared === null,
    /* Out of the totals, so findable on purpose rather than only by absence */
    theirs: (row: (typeof allRows)[number]) => row.theirLine,
    /*
      What is actually running: stock on their shelf, or a replenishment sent
      and not yet reported. Everything finished falls away, which is the point
      of landing here rather than on the whole history.
    */
    live: (row: (typeof allRows)[number]) =>
      !row.closed && !row.theirLine && ((row.heldDeclared ?? 0) > 0 || row.heldDeclared === null),
    closed: (row: (typeof allRows)[number]) => row.closed,
  } as const;

  const rows = view === 'all' ? allRows : allRows.filter(views[view]);

  /*
    Totals stay on every consigned line whatever is filtered. A screen showing
    the live ones must not also quietly restate what is owed, or the filter
    becomes a way of under-reporting it.
  */

  return (
    <div className="space-y-5">
      <div className="border-border-primary bg-fill-muted/20 flex flex-col gap-3 rounded-xl border p-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-end">
          <label className="flex flex-col gap-1">
            <span className="text-text-muted text-xs">Distributor</span>
            <select
              value={outletId ?? ''}
              onChange={(event) => setOutletId(event.target.value)}
              className="border-border-primary bg-fill-primary text-text-primary min-h-9 w-full rounded-md border px-2 text-sm lg:w-auto"
            >
              {setup.data?.outlets.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-text-muted text-xs">Owner</span>
            <select
              value={ownerId}
              onChange={(event) => setOwnerId(event.target.value)}
              className="border-border-primary bg-fill-primary text-text-primary min-h-9 w-full rounded-md border px-2 text-sm lg:w-auto"
            >
              <option value="">Every owner</option>
              {setup.data?.owners.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                  {row.termsDays === null ? ' · open-ended' : ` · ${row.termsDays}d`}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-text-muted text-xs">Find a wine</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name or LWIN…"
              className="border-border-primary bg-fill-primary text-text-primary min-h-9 w-full rounded-md border px-2 text-sm lg:w-56"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Button
            colorRole="muted"
            size="sm"
            isDisabled={syncOut.isPending || !outletId}
            onClick={() => outletId && syncOut.mutate({ outletId })}
          >
            {syncOut.isPending ? 'Reading Zoho…' : 'Read invoices'}
          </Button>
          <Button
            colorRole="brand"
            size="sm"
            isDisabled={pull.isPending}
            onClick={() => pull.mutate({})}
          >
            {pull.isPending ? 'Pulling…' : 'Pull their stock'}
          </Button>
        </div>
      </div>

      {outlet ? (
        <div className="border-border-primary space-y-3 rounded-xl border px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <span className="flex items-center gap-2">
              <Typography variant="labelSm">{outlet.name}</Typography>
              <Badge
                size="xs"
                colorRole={outlet.connector === 'api' ? 'success' : 'muted'}
              >
                {outlet.connector === 'api' ? 'live feed' : 'upload'}
              </Badge>
              {/*
                A filtered total and an outlet total look identical as a
                number, and reading one as the other is how someone concludes
                stock has gone missing.
              */}
              {isFiltered ? (
                <Badge size="xs" colorRole="warning">
                  filtered
                </Badge>
              ) : null}
            </span>
            {[
              ['Position read', formatWhen(outlet.lastSnapshotAt)],
              ['Their consigned lines', String(outlet.consignedLines)],
              [
                'Their stock, all owners',
                `${formatBottles(outlet.consignedBottles)} btl`,
              ],
              [
                isFiltered ? 'Out, this selection' : 'Out, all owners',
                summary ? `${formatBottles(summary.outBottles)} btl` : '—',
              ],
              [
                isFiltered ? 'Their stock, this selection' : 'Their stock, matched',
                summary ? `${formatBottles(summary.heldDeclared)} btl` : '—',
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <Typography variant="bodyXs" colorRole="muted" asChild>
                  <p>{label}</p>
                </Typography>
                <Typography variant="labelMd" asChild>
                  <p className="tabular-nums">{value}</p>
                </Typography>
              </div>
            ))}
          </div>

          <div className="border-border-primary flex flex-wrap gap-2 border-t pt-2">
            {(setup.data?.owners ?? []).map((owner) => (
              <button
                key={owner.id}
                type="button"
                onClick={() => setOwnerId(ownerId === owner.id ? '' : owner.id)}
                className={`rounded-full px-2.5 py-1 text-xs transition ${colourOf(owner.id).chip} ${
                  ownerId === owner.id ? 'ring-border-brand ring-2' : ''
                }`}
              >
                {owner.name}
                <span className="ml-1.5 tabular-nums opacity-70">
                  {formatBottles(owner.outBottles)}
                </span>
              </button>
            ))}
          </div>

          {(summary?.unmatched ?? 0) > 0 ? (
            <div className="border-border-primary flex flex-wrap gap-x-6 gap-y-1 border-t pt-2">
              {(summary?.unmatched ?? 0) > 0 ? (
                <Typography variant="bodyXs" colorRole="muted" asChild>
                  <p>
                    {summary?.unmatched} of ours are not coded at their end, so
                    their position is unknown rather than nil.
                  </p>
                </Typography>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div>
        <Typography variant="labelSm" asChild>
          <h2 className="mb-2">The month</h2>
        </Typography>
        {/*
          Upload then statement, in that order and numbered. A statement read
          before the month is loaded is empty, which reads as nothing having
          sold rather than as nothing having been uploaded.
        */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="relative">
            <span className="bg-fill-brand text-text-brand-on-fill absolute -left-1 -top-2 z-10 flex size-5 items-center justify-center rounded-full text-[11px] font-semibold">
              1
            </span>
            <SalesUpload outletId={outletId} onImported={invalidate} />
          </div>
          <div className="relative">
            <span className="bg-fill-brand text-text-brand-on-fill absolute -left-1 -top-2 z-10 flex size-5 items-center justify-center rounded-full text-[11px] font-semibold">
              2
            </span>
            <StatementPanel
              outletId={outletId}
              owners={setup.data?.owners ?? []}
            />
          </div>
        </div>
      </div>

      <CodeLinkPanel outletId={outletId} onLinked={invalidate} />

      <div className="space-y-2">
        <Typography variant="labelSm" asChild>
          <h2>Every wine</h2>
        </Typography>

        {/*
          The invoice is the unit of work even though the wine is the unit of
          storage. INV-000236 carries seventeen lines, thirteen of them one
          owner's, and saying so one dropdown at a time is how a correct answer
          goes unrecorded.
        */}
        <div className="border-border-primary flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-2">
          <Typography variant="bodyXs" colorRole="muted" asChild>
            <span>Every wine on invoice</span>
          </Typography>
          <input
            value={bulkRef}
            onChange={(event) => setBulkRef(event.target.value)}
            placeholder="INV-000236"
            className="border-border-primary w-36 rounded border px-2 py-1 text-xs"
          />
          <Typography variant="bodyXs" colorRole="muted" asChild>
            <span>belongs to</span>
          </Typography>
          <select
            value={bulkOwner}
            onChange={(event) => setBulkOwner(event.target.value)}
            className="border-border-primary rounded border px-2 py-1 text-xs"
          >
            <option value="">— choose —</option>
            {(setup.data?.owners ?? []).map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={
              !bulkRef.trim() || !bulkOwner || setInvoiceOwner.isPending
            }
            onClick={() =>
              setInvoiceOwner.mutate({
                outletId: outletId ?? '',
                docRef: bulkRef.trim(),
                ownerId: bulkOwner,
              })
            }
            className="bg-fill-brand text-text-on-brand hover:bg-fill-brand/90 rounded px-2 py-1 text-xs font-medium disabled:opacity-50"
          >
            Set them
          </button>
          <Typography variant="bodyXs" colorRole="muted" asChild>
            <span>
              Then correct the few that differ — a MIX invoice is four actions,
              not seventeen.
            </span>
          </Typography>
        </div>
        <Typography variant="bodyXs" colorRole="muted" asChild>
          <p className="max-w-2xl">
            What we invoiced out against what they say they hold. Sold and
            Billed live on the statement above.
          </p>
        </Typography>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {(
            [
              ['live', 'Live', allRows.filter(views.live).length, false],
              ['all', 'All', allRows.length, false],
              [
                'attention',
                'Needs a look',
                allRows.filter(views.attention).length,
                true,
              ],
              ['holding', 'In their stock', allRows.filter(views.holding).length, false],
              ['empty', 'Sold through', allRows.filter(views.empty).length, false],
              [
                'unknown',
                'Position unknown',
                allRows.filter(views.unknown).length,
                false,
              ],
              ['theirs', 'They buy', allRows.filter(views.theirs).length, false],
              ['closed', 'Closed', allRows.filter(views.closed).length, false],
            ] as const
          ).map(([key, label, count, urgent]) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={`rounded-full border px-2.5 py-1 text-xs transition ${
                view === key
                  ? 'border-border-brand bg-fill-brand/10 text-text-brand'
                  : urgent && count > 0
                    ? 'border-border-primary text-text-warning hover:bg-fill-muted/30'
                    : 'border-border-primary text-text-muted hover:bg-fill-muted/30'
              }`}
            >
              {label}
              <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
            </button>
          ))}
        </div>
      </div>

      {balances.isLoading ? (
        <Typography variant="bodySm" colorRole="muted" asChild>
          <p>Reading the positions…</p>
        </Typography>
      ) : balances.isError ? (
        /*
          A failed query used to fall through to the empty state, so the page
          announced that nothing had ever been invoiced to this distributor
          while two hundred bottles sat behind a broken query. Wrong and
          alarming, and it hid the fault instead of reporting it.
        */
        <div className="border-border-danger bg-fill-danger/5 rounded-xl border p-6">
          <Typography variant="bodySm" colorRole="danger" asChild>
            <p className="font-medium">The positions could not be read.</p>
          </Typography>
          <Typography variant="bodyXs" colorRole="muted" asChild>
            <p className="mt-1">{balances.error.message}</p>
          </Typography>
        </div>
      ) : rows.length === 0 ? (
        <div className="border-border-primary rounded-xl border p-8 text-center">
          <Typography variant="bodySm" colorRole="muted" asChild>
            <p>
              {allRows.length === 0 ? (
                <>
                  Nothing invoiced out to this distributor yet. Press{' '}
                  <strong>Read invoices</strong> to take the consignment
                  invoices from Zoho.
                </>
              ) : view === 'attention' ? (
                'Nothing needs a look — every wine they hold reconciles against what we sent.'
              ) : (
                'No wine matches that view. Clear the filters to see the rest.'
              )}
            </p>
          </Typography>
        </div>
      ) : (
        <div className="border-border-primary max-h-[32rem] overflow-auto rounded-xl border">
          <table className="w-full min-w-[54rem] text-left text-sm">
            {/* Sticky, because the columns stop meaning anything once scrolled past */}
            <thead className="text-text-muted bg-fill-primary border-border-primary sticky top-0 z-10 border-b">
              <tr>
                <th className="bg-fill-primary py-2 pl-4 pr-3 font-medium">Owner</th>
                <th className="bg-fill-primary py-2 pr-3 font-medium">Wine</th>
                <th className="bg-fill-primary py-2 pr-3 font-medium">Codes</th>
                <th className="bg-fill-primary py-2 pr-3 text-right font-medium">
                  Pack
                </th>
                <th className="border-border-primary bg-fill-primary border-l py-2 pr-3 text-right font-medium">
                  Out
                </th>
                <th className="bg-fill-primary py-2 pr-3 text-right font-medium">
                  Value
                </th>
                <th
                  className="border-border-primary bg-fill-primary border-l py-2 pr-3 text-right font-medium"
                  title="What the distributor reports holding, from their own live feed."
                >
                  Distributor stock
                </th>
                <th
                  className="bg-fill-primary py-2 pr-3 text-right font-medium"
                  title="What we invoiced out, less what they still hold — so what has sold. Replaced by their own figure once the month's report is in."
                >
                  Sold
                </th>
                <th
                  className="bg-fill-primary py-2 pr-3 text-right font-medium"
                  title="The depleted bottles at the rate we invoiced them out at."
                >
                  Sold value
                </th>
                <th
                  className="bg-fill-primary py-2 pr-4 font-medium"
                  title="Consignment, or a line the distributor now buys outright."
                >
                  Basis
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.ownerId}-${row.lwin18 ?? row.productName}`}
                  className={`border-border-primary hover:bg-fill-muted/20 border-b border-l-[3px] last:border-b-0 ${colourOf(row.ownerId).edge}`}
                >
                  {/*
                    The name on every line, not only when it changes. The table
                    sorts by bottles, so owners alternate constantly and a
                    "same as above" mark means the eye has to count upwards to
                    answer the one question this page exists for. Colour does
                    the scanning; the name does the certainty.
                  */}
                  {/*
                    Editable, because for some invoices this is the only place
                    the answer can come from. Zoho returns none of the header
                    rows a CONSIGNMENT_MIX invoice groups its lines under — 292
                    rows read at City Drinks, 0 headers — so those lines arrive
                    anonymous however carefully the document was written, and
                    land on whoever takes the unattributed.
                  */}
                  <td className="whitespace-nowrap py-2 pl-3 pr-3">
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`size-2 shrink-0 rounded-full ${colourOf(row.ownerId).dot}`}
                      />
                      {row.lwin18 ? (
                        <select
                          value={row.ownerId}
                          disabled={setOwner.isPending}
                          onChange={(event) =>
                            setOwner.mutate({
                              outletId: outletId ?? '',
                              lwin18: row.lwin18 ?? '',
                              ownerId: event.target.value || null,
                              productName: row.productName,
                            })
                          }
                          className="hover:border-border-primary cursor-pointer rounded border border-transparent bg-transparent py-0.5 pr-1"
                          title="Whose wine this is. Set here when the invoice could not say."
                        >
                          {/*
                            Unsaying it matters as much as saying it: a wrong
                            pick should be retractable to "whatever the invoice
                            says", not merely replaceable with another guess.
                          */}
                          <option value="">— from the invoice —</option>
                          {(setup.data?.owners ?? []).map((owner) => (
                            <option key={owner.id} value={owner.id}>
                              {owner.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        row.ownerName
                      )}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    {row.productName}
                    {/*
                      Why this row is flagged, said here rather than left to be
                      worked out from three columns.
                    */}
                    {(goneOf(row) ?? 0) < 0 ? (
                      <Badge size="xs" colorRole="danger" className="ml-2">
                        they hold {Math.abs(goneOf(row) ?? 0)} more than we sent
                      </Badge>
                    ) : null}
                    {row.packAssumed ? (
                      <Badge size="xs" colorRole="warning" className="ml-2">
                        pack assumed
                      </Badge>
                    ) : null}
                  </td>
                  <td className="text-text-faint py-2 pr-3 font-mono text-[11px] leading-tight">
                    <span className="block">{row.lwin18 ?? '—'}</span>
                    <span className="block">{row.outletCode ?? ''}</span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {row.pack ?? '—'}
                    {/* An assumed pack is the quietest way to be wrong by six */}
                    {row.packAssumed ? (
                      <Badge size="xs" colorRole="warning" className="ml-1">
                        assumed
                      </Badge>
                    ) : null}
                  </td>
                  <td className="border-border-primary text-text-primary border-l py-2 pr-3 text-right font-medium tabular-nums">
                    {formatBottles(row.outBottles)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {row.outValue > 0
                      ? formatValue(row.outValue, row.currency)
                      : '—'}
                  </td>
                  {/*
                    Null is not zero. A wine the outlet has never coded has an
                    unknown position, and reading that as none invents a
                    variance against what we sent.
                  */}
                  <td className="border-border-primary border-l py-2 pr-3 text-right tabular-nums">
                    {row.heldDeclared === null ? (
                      <span
                        className="text-text-faint"
                        title="They have no code of ours for this wine, so their position is unknown — not nil."
                      >
                        —
                      </span>
                    ) : row.heldDeclared === 0 ? (
                      /* Nil is a real answer and must not look like no answer */
                      <span className="text-text-muted">0</span>
                    ) : (
                      formatBottles(row.heldDeclared)
                    )}
                  </td>
                  {/*
                    What has left their shelf: everything we sent, less what
                    they still have. Not the month's sales — it is all-time,
                    and it assumes nothing came back, which is true today and
                    would stop being true the first time a credit note is
                    raised. A negative means they hold more than we ever sent
                    them, which is a wrong pack or a mis-matched code.
                  */}
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {row.heldDeclared === null ? (
                      <span className="text-text-faint">—</span>
                    ) : row.outBottles - row.heldDeclared < 0 ? (
                      <span
                        className="text-text-danger"
                        title="They hold more than we ever invoiced out — a wrong pack, or a code matched to the wrong wine."
                      >
                        {formatBottles(row.outBottles - row.heldDeclared)}
                      </span>
                    ) : (
                      formatBottles(row.outBottles - row.heldDeclared)
                    )}
                  </td>
                  <td className="text-text-primary py-2 pr-3 text-right font-medium tabular-nums">
                    {soldValueOf(row) === null ? (
                      <span className="text-text-faint">—</span>
                    ) : (
                      formatValue(soldValueOf(row) ?? 0, row.currency)
                    )}
                  </td>
                  {/*
                    Said here because it is a fact about this line, and the
                    line is where it will be noticed — a fast mover they have
                    taken onto their own book stops being ours to settle.
                  */}
                  <td className="whitespace-nowrap py-2 pr-4">
                    {row.lwin18 ? (
                      <button
                        type="button"
                        disabled={setBought.isPending}
                        onClick={() =>
                          setBought.mutate({
                            outletId: outletId ?? '',
                            lwin18: row.lwin18 ?? '',
                            bought: !row.theirLine,
                            productName: row.productName,
                          })
                        }
                        className="text-text-muted hover:text-text-primary text-xs underline decoration-dotted disabled:opacity-50"
                        title={
                          row.theirLine
                            ? 'They buy this line. Click to put it back on consignment.'
                            : 'On consignment. Click if they now buy this line outright.'
                        }
                      >
                        {row.theirLine ? 'they buy' : 'consigned'}
                      </button>
                    ) : null}
                    {row.boughtOut && !row.theirLine ? (
                      <Badge size="xs" colorRole="primary" className="ml-1">
                        bought out
                      </Badge>
                    ) : null}
                    {/*
                      Closing is only ever about the working view. What sold is
                      still sold and still owed for, and anything sent after
                      today reopens the line without anybody remembering to.
                    */}
                    {row.lwin18 && !row.theirLine ? (
                      <button
                        type="button"
                        disabled={setClosed.isPending}
                        onClick={() =>
                          setClosed.mutate({
                            outletId: outletId ?? '',
                            lwin18: row.lwin18 ?? '',
                            closed: !row.closed,
                            productName: row.productName,
                          })
                        }
                        className="text-text-muted hover:text-text-primary ml-2 text-xs underline decoration-dotted disabled:opacity-50"
                        title={
                          row.closed
                            ? `Closed ${row.closedAt ?? ''}. Click to bring it back.`
                            : 'Take this finished line off the live view. It returns on its own if they hold it again or you send more.'
                        }
                      >
                        {row.closed ? 'reopen' : 'close'}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {summary && summary.wines > 0 ? (
        <div className="text-text-muted flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
          <span className="tabular-nums">
            {view === 'all' ? '' : 'All consigned lines: '}
            {summary.wines} wines · {formatBottles(summary.outBottles)} out ·{' '}
            {formatBottles(summary.heldDeclared)} in their stock ·{' '}
            {formatBottles(summary.gone)} sold ·{' '}
            {formatValue(soldValueTotal, rows[0]?.currency ?? null)} sold
            {summary.unmatched > 0
              ? ` · ${summary.unmatched} position unknown`
              : ''}
          </span>
          {summary.packAssumed > 0 ? (
            <span className="text-text-warning">
              {summary.packAssumed} with an assumed pack
            </span>
          ) : null}
          <span>
            Sold is what we consigned out less what their feed says they still
            hold, so it depletes as their stock does. A month&rsquo;s figure
            still needs their report, or two snapshots differenced.
          </span>
        </div>
      ) : null}
    </div>
  );
};

export default DistributionClient;
