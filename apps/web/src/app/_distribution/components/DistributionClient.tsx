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
 * Sold and Billed are not here yet: Sold needs two snapshot boundaries to
 * difference or the distributor's monthly report, and Billed needs the owner's
 * bill. Showing them as zero would read as nothing having sold, which is a
 * different claim from not yet knowing.
 */
const DistributionClient = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const [outletId, setOutletId] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<
    'all' | 'attention' | 'holding' | 'empty' | 'unknown'
  >('all');

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

  const syncOut = useMutation({
    ...api.distribution.admin.syncOutFromZoho.mutationOptions(),
    onSuccess: async (result) => {
      toast.success(
        `${result.invoicesTaken} consignment invoices · ${result.lines} lines · ${formatBottles(result.bottles)} bottles`,
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
  } as const;

  const rows = view === 'all' ? allRows : allRows.filter(views[view]);

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

          {outlet.unmatchedAtOutlet > 0 || (summary?.unmatched ?? 0) > 0 ? (
            <div className="border-border-primary flex flex-wrap gap-x-6 gap-y-1 border-t pt-2">
              {outlet.unmatchedAtOutlet > 0 ? (
                <Typography variant="bodyXs" colorRole="warning" asChild>
                  <p>
                    {outlet.unmatchedAtOutlet} wines they hold carry no code of
                    ours — their bottles cannot reach an owner.
                  </p>
                </Typography>
              ) : null}
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

      <CodeLinkPanel
        outletId={outletId}
        ownerId={ownerId || null}
        onLinked={invalidate}
      />

      <div className="space-y-2">
        <Typography variant="labelSm" asChild>
          <h2>Every wine</h2>
        </Typography>
        <Typography variant="bodyXs" colorRole="muted" asChild>
          <p className="max-w-2xl">
            What we invoiced out against what they say they hold. Sold and
            Billed live on the statement above.
          </p>
        </Typography>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {(
            [
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
                  className="bg-fill-primary py-2 pr-4 text-right font-medium"
                  title="What we invoiced out, less what they still hold — so what has sold. Replaced by their own figure once the month's report is in."
                >
                  Sold
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
                  <td className="whitespace-nowrap py-2 pl-3 pr-3">
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`size-2 shrink-0 rounded-full ${colourOf(row.ownerId).dot}`}
                      />
                      {row.ownerName}
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
                  <td className="py-2 pr-4 text-right tabular-nums">
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {summary && summary.wines > 0 ? (
        <div className="text-text-muted flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
          <span className="tabular-nums">
            {summary.wines} wines · {formatBottles(summary.outBottles)} out ·{' '}
            {formatBottles(summary.heldDeclared)} in their stock ·{' '}
            {formatBottles(summary.gone)} sold
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
            Sold and Billed arrive with the month&rsquo;s report, or once two
            snapshots can be differenced.
          </span>
        </div>
      ) : null}
    </div>
  );
};

export default DistributionClient;
