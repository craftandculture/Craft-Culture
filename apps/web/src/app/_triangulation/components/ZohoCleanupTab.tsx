'use client';

import { IconDownload, IconWand } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import type { ZohoCleanupWine } from '../controller/adminGetZohoCleanup';

/** Which wines are worth showing while the work is being done */
type Filter = 'todo' | 'blocked' | 'all';

/** What needs doing to this wine in Zoho, in the order it has to happen */
const stateOf = (wine: ZohoCleanupWine) => {
  if (!wine.targetLwin18) {
    return {
      label: 'No LWIN yet',
      colorRole: 'danger' as const,
      action:
        'The SKU has no dashed LWIN, so there is nothing to work towards. Seed it from the WMS or set it on the SKUs tab.',
    };
  }

  if (!wine.hasStandard) {
    return {
      label: 'Create the item',
      colorRole: 'warning' as const,
      action:
        'No Zoho item carries this LWIN. Put the LWIN on one existing item, or add a new item, then deactivate the rest.',
    };
  }

  if (wine.legacyCodes > 0) {
    return {
      label: `Deactivate ${wine.legacyCodes}`,
      colorRole: 'warning' as const,
      action:
        'The right item exists. Make the others inactive — leave them in place so their invoices are untouched.',
    };
  }

  return {
    label: 'Done',
    colorRole: 'success' as const,
    action: 'One item, carrying the dashed LWIN. Nothing to do.',
  };
};

/**
 * The Zoho item clean-up, one wine at a time
 *
 * Mapping makes today's figures right and does nothing to stop the mess
 * regrowing: the next invoice is raised against the same Zoho item and brings
 * the same code and the same wrong pack size back with it.
 *
 * The safe order is per wine — put the dashed LWIN on one item, then make the
 * others inactive. Editing an item that historical invoices point at is the
 * thing to avoid; deactivating one changes nothing already issued, and the
 * alias table goes on resolving the old codes, so history keeps reading
 * correctly throughout.
 */
const ZohoCleanupTab = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<Filter>('todo');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const cleanup = useQuery(api.triangulation.admin.getZohoCleanup.queryOptions());

  const suggestions = useQuery({
    ...api.triangulation.admin.suggestLwinFromWms.queryOptions(),
    // Only fetched when the blocked list is being worked through: it reads all
    // of warehouse stock against every SKU and is wasted on the other views.
    enabled: filter === 'blocked',
  });

  const setLwin = useMutation({
    ...api.triangulation.admin.setSkuLwin.mutationOptions(),
    onSuccess: async (result) => {
      toast.success(`${result.wCode} → ${result.lwin18}`);
      await queryClient.invalidateQueries({
        queryKey: api.triangulation.admin.suggestLwinFromWms.queryKey(),
      });
      await queryClient.invalidateQueries({
        queryKey: api.triangulation.admin.getZohoCleanup.queryKey(),
      });
      await queryClient.invalidateQueries({
        queryKey: api.triangulation.admin.getSkus.queryKey(),
      });
    },
    onError: (error) => toast.error(error.message),
  });

  const backfill = useMutation({
    ...api.triangulation.admin.backfillLwinFromWms.mutationOptions(),
    onSuccess: async (result) => {
      const how = [
        result.byCode ? `${result.byCode} matched on the W code` : null,
        result.byName ? `${result.byName} on the wine name` : null,
      ]
        .filter(Boolean)
        .join(', ');

      if (result.dryRun) {
        toast.info(
          result.filled === 0
            ? `Nothing in the WMS matches the ${result.remaining} SKUs without a LWIN`
            : `${result.filled} SKUs can take a LWIN from the WMS (${how}); ${result.remaining} have no match. Run it again to apply.`,
        );
        return;
      }

      toast.success(
        `${result.filled} SKUs now carry their dashed LWIN · ${result.remaining} still without one`,
      );
      await queryClient.invalidateQueries({
        queryKey: api.triangulation.admin.getZohoCleanup.queryKey(),
      });
      await queryClient.invalidateQueries({
        queryKey: api.triangulation.admin.getSkus.queryKey(),
      });
    },
    onError: (error) => toast.error(error.message),
  });

  const allWines = cleanup.data?.wines ?? [];
  const summary = cleanup.data?.summary;

  const term = search.trim().toLowerCase();

  const wines = allWines
    .filter((wine) => {
      if (filter === 'todo') {
        return !!wine.targetLwin18 && (!wine.hasStandard || wine.legacyCodes > 0);
      }

      if (filter === 'blocked') return !wine.targetLwin18;

      return true;
    })
    .filter((wine) =>
      term
        ? [wine.wCode, wine.productName, wine.targetLwin18]
            .filter(Boolean)
            .some((field) => field?.toLowerCase().includes(term))
        : true,
    );

  /**
   * The list as a file, because the work happens in Zoho and a screen cannot be
   * worked down beside another system.
   */
  const download = () => {
    const escape = (value: string | number | null) => {
      const text = String(value ?? '');
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    const csv = [
      [
        'W code',
        'Wine',
        'Vintage',
        'Keep this SKU (C&C LWIN)',
        'Zoho code in use',
        'Bottles on it',
        'Invoice lines',
        'Action',
        'Invoices',
      ].join(','),
      ...wines.flatMap((wine) =>
        wine.codes.map((code) =>
          [
            wine.wCode,
            wine.productName,
            wine.vintage,
            wine.targetLwin18,
            code.code,
            code.bottles,
            code.lines,
            code.isStandard
              ? 'Keep active'
              : wine.targetLwin18
                ? 'Make inactive'
                : 'No LWIN on the SKU yet',
            code.docRefs.join(' '),
          ]
            .map(escape)
            .join(','),
        ),
      ),
    ].join('\n');

    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'zoho-item-cleanup.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="border-border-primary bg-fill-muted/20 rounded-xl border p-4">
        <Typography variant="labelSm">
          Fixing Zoho at source, without touching history
        </Typography>
        <Typography variant="bodyXs" colorRole="muted" asChild>
          <p className="mt-1 max-w-3xl">
            Per wine: make sure one item carries the dashed C&amp;C LWIN, then
            make the others inactive. Never edit an item that issued invoices
            point at — deactivating changes nothing already sent, and the alias
            table goes on resolving the old codes, so the reconciliation keeps
            reading history correctly the whole way through.
          </p>
        </Typography>
        <Typography variant="bodyXs" colorRole="warning" asChild>
          <p className="mt-2 max-w-3xl">
            After changing an item in Zoho, run a forced sync. An item-master
            edit does not bump the sales order&rsquo;s last-modified date, so an
            ordinary sync will keep reading the old code and it will look as
            though nothing happened.
          </p>
        </Typography>

        {summary && summary.noLwin > 0 ? (
          <div className="border-border-warning/40 bg-fill-warning/10 mt-3 rounded-lg border p-3">
            <Typography variant="labelSm" colorRole="warning">
              {summary.noLwin} of these wines have no LWIN on the SKU, so there
              is nothing to rename their Zoho items to
            </Typography>
            <Typography variant="bodyXs" colorRole="muted" asChild>
              <p className="mt-0.5">
                Seeding the registry from the WMS leaves existing SKUs alone, so
                any SKU that arrived another way never received its LWIN. The
                WMS already holds them. Nothing below is actionable until this
                is done.
              </p>
            </Typography>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                colorRole="muted"
                variant="outline"
                isDisabled={backfill.isPending}
                onClick={() => backfill.mutate({ dryRun: true })}
              >
                Check first
              </Button>
              <Button
                size="sm"
                colorRole="brand"
                isDisabled={backfill.isPending}
                onClick={() => backfill.mutate({ dryRun: false })}
              >
                <IconWand className="mr-1 size-4" />
                {backfill.isPending
                  ? 'Reading the WMS…'
                  : 'Take the LWINs from the WMS'}
              </Button>
            </div>
          </div>
        ) : null}

        {summary ? (
          <div className="mt-3 flex flex-wrap gap-5">
            {[
              { label: 'Done', value: summary.clean, hint: 'one clean item' },
              {
                label: 'To deactivate',
                value: summary.deactivateOnly,
                hint: 'right item exists',
              },
              {
                label: 'Need the LWIN set on an item',
                value: summary.needsStandard,
                hint: 'no standard item yet',
              },
              {
                label: 'Blocked',
                value: summary.noLwin,
                hint: 'no LWIN on the SKU',
              },
              {
                label: 'Legacy codes in all',
                value: summary.legacyCodes,
                hint: 'to make inactive',
              },
            ].map((stat) => (
              <div key={stat.label}>
                <Typography variant="headingSm" asChild>
                  <p className="tabular-nums">
                    {stat.value.toLocaleString('en-GB')}
                  </p>
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" asChild>
                  <p>
                    {stat.label} · {stat.hint}
                  </p>
                </Typography>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { value: 'todo', label: 'To do' },
            { value: 'blocked', label: 'Blocked' },
            { value: 'all', label: 'Everything' },
          ] as const
        ).map((option) => (
          <Button
            key={option.value}
            size="sm"
            colorRole={filter === option.value ? 'brand' : 'muted'}
            variant={filter === option.value ? 'default' : 'outline'}
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </Button>
        ))}
        <div className="w-64">
          <Input
            placeholder="Search wine, W code or LWIN…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Typography variant="bodySm" colorRole="muted">
          {wines.length} wine{wines.length === 1 ? '' : 's'}
        </Typography>
        <Button
          size="sm"
          colorRole="muted"
          variant="outline"
          isDisabled={wines.length === 0}
          onClick={download}
        >
          <IconDownload className="mr-1 size-4" />
          Download worklist
        </Button>
      </div>

      {cleanup.isLoading ? (
        <Typography variant="bodySm" colorRole="muted">
          Reading the Zoho codes in use…
        </Typography>
      ) : wines.length === 0 ? (
        <div className="border-border-primary rounded-xl border p-8 text-center">
          <Typography variant="labelSm" colorRole="success">
            Nothing in this view.
          </Typography>
          <Typography variant="bodySm" colorRole="muted" asChild>
            <p className="mt-1">
              {filter === 'todo'
                ? 'Every wine has one item carrying its dashed LWIN.'
                : 'Try another filter.'}
            </p>
          </Typography>
        </div>
      ) : (
        <div className="space-y-2">
          {wines.map((wine) => {
            const state = stateOf(wine);
            const isOpen = openId === wine.skuId;

            return (
              <div
                key={wine.skuId}
                className="border-border-primary overflow-hidden rounded-xl border"
              >
                <button
                  type="button"
                  className="hover:bg-fill-muted/20 flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
                  onClick={() => setOpenId(isOpen ? null : wine.skuId)}
                >
                  <div className="min-w-0">
                    <Typography variant="labelSm">
                      {wine.productName}
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted" asChild>
                      <p className="mt-0.5 font-mono">
                        {wine.wCode}
                        {wine.targetLwin18
                          ? ` → keep ${wine.targetLwin18}`
                          : ' → no LWIN set'}
                      </p>
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted" asChild>
                      <p className="mt-0.5">{state.action}</p>
                    </Typography>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <Typography variant="labelSm" asChild>
                        <span className="tabular-nums">
                          {wine.bottles.toLocaleString('en-GB')} btl
                        </span>
                      </Typography>
                      <Typography variant="bodyXs" colorRole="muted" asChild>
                        <p>
                          {wine.codes.length} code
                          {wine.codes.length === 1 ? '' : 's'} in use
                        </p>
                      </Typography>
                    </div>
                    <Badge size="xs" colorRole={state.colorRole}>
                      {state.label}
                    </Badge>
                  </div>
                </button>

                {isOpen && !wine.targetLwin18 ? (
                  <div className="border-border-primary border-t p-3">
                    <Typography variant="labelSm">
                      Pick this wine&rsquo;s LWIN from the warehouse
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted" asChild>
                      <p className="mt-0.5 mb-2">
                        What the warehouse holds under each code. The bottle
                        count is the tell — the right one is the one you
                        actually have.
                      </p>
                    </Typography>
                    {suggestions.isLoading ? (
                      <Typography variant="bodyXs" colorRole="muted">
                        Reading the warehouse…
                      </Typography>
                    ) : (
                      (() => {
                        const forWine = suggestions.data?.find(
                          (entry) => entry.skuId === wine.skuId,
                        );

                        if (!forWine || forWine.suggestions.length === 0) {
                          return (
                            <Typography variant="bodyXs" colorRole="muted">
                              Nothing in the warehouse resembles this wine. Set
                              the LWIN by hand on the SKUs tab.
                            </Typography>
                          );
                        }

                        return (
                          <ul className="space-y-1">
                            {forWine.suggestions.map((option) => (
                              <li
                                key={option.lwin18}
                                className="border-border-primary flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                              >
                                <div className="min-w-0">
                                  <Typography variant="bodySm" asChild>
                                    <p className="truncate">
                                      {option.productName ?? '—'}
                                      {option.vintage
                                        ? ` · ${option.vintage}`
                                        : ''}
                                    </p>
                                  </Typography>
                                  <Typography
                                    variant="bodyXs"
                                    colorRole="muted"
                                    asChild
                                  >
                                    <p className="font-mono">
                                      {option.lwin18}
                                      {option.supplierSku
                                        ? ` · received as ${option.supplierSku}`
                                        : ''}
                                    </p>
                                  </Typography>
                                </div>
                                <div className="flex shrink-0 items-center gap-3">
                                  <Typography
                                    variant="bodyXs"
                                    colorRole="muted"
                                    asChild
                                  >
                                    <span className="tabular-nums">
                                      {option.bottles.toLocaleString('en-GB')}{' '}
                                      btl on hand
                                    </span>
                                  </Typography>
                                  <Button
                                    size="xs"
                                    colorRole="brand"
                                    variant="outline"
                                    isDisabled={setLwin.isPending}
                                    onClick={() =>
                                      setLwin.mutate({
                                        skuId: wine.skuId,
                                        lwin18: option.lwin18,
                                      })
                                    }
                                  >
                                    This one
                                  </Button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        );
                      })()
                    )}
                  </div>
                ) : null}

                {isOpen ? (
                  <table className="border-border-primary w-full border-t text-left text-xs">
                    <thead className="text-text-muted bg-fill-muted/20">
                      <tr>
                        <th className="px-4 py-1.5 font-medium">Zoho code</th>
                        <th className="px-4 py-1.5 font-medium">
                          As it appears on the invoice
                        </th>
                        <th className="px-4 py-1.5 text-right font-medium">
                          Bottles
                        </th>
                        <th className="px-4 py-1.5 font-medium">Do this</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wine.codes.map((code) => (
                        <tr
                          key={code.normalizedCode}
                          className="border-border-primary border-t"
                        >
                          <td className="px-4 py-1.5 font-mono">
                            {code.code ?? '—'}
                          </td>
                          <td className="text-text-muted px-4 py-1.5">
                            {code.description ?? '—'}
                            {code.docRefs.length > 0 ? (
                              <span className="block">
                                {code.docRefs.slice(0, 4).join(', ')}
                                {code.docRefs.length > 4
                                  ? ` +${code.docRefs.length - 4}`
                                  : ''}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-1.5 text-right tabular-nums">
                            {code.bottles.toLocaleString('en-GB')}
                          </td>
                          <td className="px-4 py-1.5">
                            <Badge
                              size="xs"
                              colorRole={code.isStandard ? 'success' : 'muted'}
                            >
                              {code.isStandard
                                ? 'Keep active'
                                : wine.targetLwin18
                                  ? 'Make inactive'
                                  : 'Set the LWIN first'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ZohoCleanupTab;
