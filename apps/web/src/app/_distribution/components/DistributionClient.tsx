'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import formatBottles from '@/app/_triangulation/utils/formatBottles';
import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';


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
  const rows = balances.data?.rows ?? [];
  const summary = balances.data?.summary;

  return (
    <div className="space-y-5">
      <div className="border-border-primary bg-fill-muted/20 flex flex-wrap items-end justify-between gap-3 rounded-xl border p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-text-muted text-xs">Outlet</span>
            <select
              value={outletId ?? ''}
              onChange={(event) => setOutletId(event.target.value)}
              className="border-border-primary bg-fill-primary text-text-primary min-h-9 rounded-md border px-2 text-sm"
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
              className="border-border-primary bg-fill-primary text-text-primary min-h-9 rounded-md border px-2 text-sm"
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
              className="border-border-primary bg-fill-primary text-text-primary min-h-9 w-56 rounded-md border px-2 text-sm"
            />
          </label>
        </div>
        <div className="flex items-center gap-2">
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
            {pull.isPending ? 'Pulling…' : 'Pull outlet stock'}
          </Button>
        </div>
      </div>

      {outlet ? (
        <div className="border-border-primary flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border px-4 py-3">
          <span className="flex items-center gap-2">
            <Typography variant="labelSm">{outlet.name}</Typography>
            <Badge size="xs" colorRole={outlet.connector === 'api' ? 'success' : 'muted'}>
              {outlet.connector === 'api' ? 'live feed' : 'upload'}
            </Badge>
          </span>
          {[
            ['Position read', formatWhen(outlet.lastSnapshotAt)],
            ['Consigned lines', String(outlet.consignedLines)],
            ['They hold', `${formatBottles(outlet.consignedBottles)} btl`],
            ['We sent', summary ? `${formatBottles(summary.outBottles)} btl` : '—'],
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
          {outlet.unmatchedAtOutlet > 0 ? (
            <Typography variant="bodyXs" colorRole="warning" asChild>
              <p className="max-w-sm">
                {outlet.unmatchedAtOutlet} wines they hold carry no code of ours,
                so their bottles cannot be attributed to an owner.
              </p>
            </Typography>
          ) : null}
        </div>
      ) : null}

      {balances.isLoading ? (
        <Typography variant="bodySm" colorRole="muted" asChild>
          <p>Reading the positions…</p>
        </Typography>
      ) : rows.length === 0 ? (
        <div className="border-border-primary rounded-xl border p-8 text-center">
          <Typography variant="bodySm" colorRole="muted" asChild>
            <p>
              Nothing invoiced out to this outlet yet. Press{' '}
              <strong>Read invoices</strong> to take the consignment invoices
              from Zoho.
            </p>
          </Typography>
        </div>
      ) : (
        <div className="border-border-primary overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[54rem] text-left text-sm">
            <thead className="text-text-muted border-border-primary border-b">
              <tr>
                <th className="py-2 pl-4 pr-3 font-medium">Owner</th>
                <th className="py-2 pr-3 font-medium">Wine</th>
                <th className="py-2 pr-3 font-medium">Codes</th>
                <th className="py-2 pr-3 text-right font-medium">Pack</th>
                <th className="border-border-primary border-l py-2 pr-3 text-right font-medium">
                  Out
                </th>
                <th className="py-2 pr-3 text-right font-medium">Value</th>
                <th className="border-border-primary border-l py-2 pr-4 text-right font-medium">
                  They hold
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.ownerId}-${row.lwin18 ?? row.productName}`}
                  className="border-border-primary border-b last:border-0"
                >
                  <td className="py-2 pl-4 pr-3">{row.ownerName}</td>
                  <td className="py-2 pr-3">{row.productName}</td>
                  <td className="text-text-muted py-2 pr-3 font-mono text-xs">
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
                  <td className="border-border-primary border-l py-2 pr-3 text-right tabular-nums">
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
                  <td className="border-border-primary border-l py-2 pr-4 text-right tabular-nums">
                    {row.heldDeclared === null ? (
                      <span className="text-text-muted">not coded</span>
                    ) : (
                      formatBottles(row.heldDeclared)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {summary && summary.wines > 0 ? (
        <Typography variant="bodyXs" colorRole="muted" asChild>
          <p>
            {summary.wines} wines · {formatBottles(summary.outBottles)} bottles
            out · {formatBottles(summary.heldDeclared)} still with the outlet
            {summary.unmatched > 0
              ? ` · ${summary.unmatched} not coded at their end`
              : ''}
            {summary.packAssumed > 0
              ? ` · ${summary.packAssumed} with an assumed pack`
              : ''}
            . Sold and Billed arrive once there are two snapshot boundaries to
            difference, or the month&rsquo;s report.
          </p>
        </Typography>
      ) : null}
    </div>
  );
};

export default DistributionClient;
