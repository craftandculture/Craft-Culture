'use client';

import { IconDatabaseImport, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fragment, useEffect, useState } from 'react';
import { toast } from 'sonner';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

/**
 * The canonical W code registry and the external codes attached to each
 *
 * Pack size lives here rather than on the import, because it is what converts
 * case-denominated packing lists and Zoho invoices into the bottles the City
 * Drinks sheets are counted in — get it wrong and both sides drift.
 */
/** Pairs dismissed as legitimately separate wines, remembered between visits */
const KEPT_BOTH_KEY = 'triangulation.keptBothPairs';

const SkusTab = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [packEdits, setPackEdits] = useState<Record<string, number>>({});
  /** Codes being typed into each SKU's "add a code" box */
  const [codeDrafts, setCodeDrafts] = useState<Record<string, string>>({});
  /** Pairs judged legitimately separate, and the pair awaiting a second click */
  const [keptBoth, setKeptBoth] = useState<string[]>([]);
  const [confirmingMerge, setConfirmingMerge] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(KEPT_BOTH_KEY);

    if (stored) {
      setKeptBoth(JSON.parse(stored) as string[]);
    }
  }, []);

  const keepBoth = (key: string) => {
    setKeptBoth((current) => {
      const next = [...current, key];
      window.localStorage.setItem(KEPT_BOTH_KEY, JSON.stringify(next));
      return next;
    });
  };

  const splits = useQuery(api.triangulation.admin.findSplitSkus.queryOptions());

  const assumedPacks = useQuery(
    api.triangulation.admin.getAssumedPacks.queryOptions(),
  );

  const skus = useQuery(
    api.triangulation.admin.getSkus.queryOptions({ search, limit: 1000 }),
  );

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: api.triangulation.admin.getSkus.queryKey(),
    });
    await queryClient.invalidateQueries({
      queryKey: api.triangulation.admin.getTriangulation.queryKey(),
    });
  };

  const seedFromWms = useMutation({
    ...api.triangulation.admin.seedSkusFromWms.mutationOptions(),
    onSuccess: async (result) => {
      toast.success(
        `${result.created} SKU${result.created === 1 ? '' : 's'} added from the WMS (${result.skipped} already known)`,
      );
      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const mergeSkus = useMutation({
    ...api.triangulation.admin.mergeSkus.mutationOptions(),
    onSuccess: async (result) => {
      toast.success(
        `Merged — ${result.linesMoved} lines and ${result.aliasesMoved} codes moved across, ${result.recalculatedImports} imports recalculated`,
      );
      await queryClient.invalidateQueries({
        queryKey: api.triangulation.admin.findSplitSkus.queryKey(),
      });
      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const moveCode = useMutation({
    ...api.triangulation.admin.moveCodeToSku.mutationOptions(),
    onSuccess: async (result) => {
      toast.success(
        result.lines === 0
          ? `Code mapped to ${result.wCode}, but no imported line carries it yet`
          : `${result.lines} line${result.lines === 1 ? '' : 's'} moved onto ${result.wCode} — ${result.bottles.toLocaleString('en-GB')} bottles`,
      );
      await queryClient.invalidateQueries({
        queryKey: api.triangulation.admin.getUnmapped.queryKey(),
      });
      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const repairPacks = useMutation({
    ...api.triangulation.admin.repairPackSizes.mutationOptions(),
    onSuccess: async (result) => {
      if (result.dryRun) {
        toast.info(
          result.changed === 0
            ? 'Every pack size already matches its LWIN'
            : `${result.changed} pack sizes disagree with their LWIN — e.g. ${result.examples
                .slice(0, 3)
                .map((c) => `${c.wCode} ${c.from}→${c.to}`)
                .join(', ')}. Run it again to apply.`,
        );
        return;
      }

      toast.success(
        `Corrected ${result.changed} pack sizes · ${result.recalculated} imports recalculated`,
      );
      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const upsertSku = useMutation({
    ...api.triangulation.admin.upsertSku.mutationOptions(),
    onSuccess: async (result) => {
      toast.success(
        result.recalculatedImports > 0
          ? `SKU updated — ${result.recalculatedImports} import${result.recalculatedImports === 1 ? '' : 's'} recalculated`
          : 'SKU updated',
      );
      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteAlias = useMutation({
    ...api.triangulation.admin.deleteAlias.mutationOptions(),
    onSuccess: async () => {
      toast.success('Mapping removed');
      await queryClient.invalidateQueries({
        queryKey: api.triangulation.admin.getUnmapped.queryKey(),
      });
      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const assumedPackRows = assumedPacks.data ?? [];
  const assumedPackLines = assumedPackRows.reduce(
    (total, row) => total + row.lines,
    0,
  );
  const assumedPackBottles = assumedPackRows.reduce(
    (total, row) => total + row.bottles,
    0,
  );

  const visibleSplits = (splits.data ?? []).filter(
    (pair) => !keptBoth.includes(`${pair.aId}-${pair.bId}`),
  );

  const rows = skus.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-64 grow">
          <Typography variant="labelXs" colorRole="muted" asChild>
            <p className="mb-1">Search</p>
          </Typography>
          <Input
            placeholder="W code, CD code, producer or wine…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            colorRole="muted"
            variant="outline"
            isDisabled={repairPacks.isPending}
            onClick={() => repairPacks.mutate({ dryRun: true })}
          >
            Check pack sizes
          </Button>
          <Button
            colorRole="muted"
            variant="outline"
            isDisabled={repairPacks.isPending}
            onClick={() => repairPacks.mutate({ dryRun: false })}
          >
            {repairPacks.isPending ? 'Fixing…' : 'Fix pack sizes from LWIN'}
          </Button>
          <Button
            colorRole="muted"
            variant="outline"
            isDisabled={seedFromWms.isPending}
            onClick={() => seedFromWms.mutate({ ownerName: 'Crurated' })}
          >
            <IconDatabaseImport className="mr-1 size-4" />
            {seedFromWms.isPending ? 'Importing…' : 'Import W codes from WMS'}
          </Button>
        </div>
      </div>

      {assumedPackRows.length > 0 ? (
        <div className="border-border-warning/40 bg-fill-warning/10 rounded-xl border p-4">
          <Typography variant="labelSm" colorRole="warning">
            {assumedPackBottles.toLocaleString('en-GB')} bottles sold on{' '}
            {assumedPackLines} invoice line
            {assumedPackLines === 1 ? '' : 's'} with an assumed pack size
          </Typography>
          <Typography variant="bodyXs" colorRole="muted" asChild>
            <p className="mt-1 max-w-3xl">
              A Zoho quantity is cases of the ordered format. These lines print
              no format and their SKU digits state none either, so there is
              nothing to multiply by and each unit is counted as a single
              bottle. If any were really cases, the sale is counted short and
              your own stock reads high by the difference. The fix is in Zoho:
              put the format in the item description, or give the item a SKU
              that carries it.
            </p>
          </Typography>
          <div className="mt-2 max-h-64 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-text-muted bg-fill-warning/10 sticky top-0">
                <tr>
                  <th className="py-1 pr-3 font-medium">Code</th>
                  <th className="py-1 pr-3 font-medium">Description</th>
                  <th className="py-1 pr-3 font-medium">Invoices</th>
                  <th className="py-1 pr-3 text-right font-medium">Lines</th>
                  <th className="py-1 text-right font-medium">Counted</th>
                </tr>
              </thead>
              <tbody>
                {assumedPackRows.map((row) => (
                  <tr
                    key={row.rawDescription}
                    className="border-border-warning/20 border-t"
                  >
                    <td className="text-text-muted py-1 pr-3 font-mono">
                      {row.rawCode ?? '—'}
                    </td>
                    <td className="py-1 pr-3">{row.rawDescription}</td>
                    <td className="text-text-muted py-1 pr-3">
                      {row.docRefs.slice(0, 3).join(', ')}
                      {row.docRefs.length > 3 ? ` +${row.docRefs.length - 3}` : ''}
                    </td>
                    <td className="py-1 pr-3 text-right tabular-nums">
                      {row.lines}
                    </td>
                    <td className="py-1 text-right tabular-nums">
                      {row.bottles.toLocaleString('en-GB')} btl
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {visibleSplits.length > 0 ? (
        <div className="border-border-warning/40 bg-fill-warning/10 rounded-xl border p-4">
          <Typography variant="labelSm" colorRole="warning">
            {visibleSplits.length} pair
            {visibleSplits.length === 1 ? '' : 's'} of SKUs look like the same wine
          </Typography>
          <Typography variant="bodyXs" colorRole="muted" asChild>
            <p className="mt-1">
              One wine under two W codes splits its own figures — part of its
              movement lands on each, so one side reads short and nothing looks
              obviously wrong. Two vintages, or a magnum beside a bottle, are
              legitimately separate; only you can tell which is which.
            </p>
          </Typography>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-text-muted">
                <tr>
                  <th className="py-1 pr-3 font-medium">W code</th>
                  <th className="py-1 pr-3 font-medium">Product</th>
                  <th className="py-1 pr-3 text-right font-medium">Lines</th>
                  <th className="py-1 pr-3 text-right font-medium">Bottles</th>
                  <th className="py-1 text-right font-medium">Merge</th>
                </tr>
              </thead>
              <tbody>
                {visibleSplits.map((pair) => (
                  <Fragment key={`${pair.aId}-${pair.bId}`}>
                    <tr className="border-border-warning/20 border-t">
                      <td className="py-1 pr-3 font-mono">{pair.aWCode}</td>
                      <td className="py-1 pr-3">
                        {pair.aName}
                        {pair.aVintage ? ` ${pair.aVintage}` : ''}
                      </td>
                      <td className="py-1 pr-3 text-right tabular-nums">
                        {pair.aLines}
                      </td>
                      <td className="py-1 pr-3 text-right tabular-nums">
                        {Math.round(pair.aBottles)}
                      </td>
                      <td className="py-1 text-right">
                        <Button
                          size="xs"
                          colorRole={
                            confirmingMerge === `${pair.aId}-keep-a`
                              ? 'danger'
                              : 'muted'
                          }
                          variant="outline"
                          isDisabled={mergeSkus.isPending}
                          onClick={() => {
                            const key = `${pair.aId}-keep-a`;
                            if (confirmingMerge !== key) {
                              setConfirmingMerge(key);
                              return;
                            }
                            mergeSkus.mutate({
                              fromSkuId: pair.bId,
                              intoSkuId: pair.aId,
                            });
                            setConfirmingMerge(null);
                          }}
                        >
                          {confirmingMerge === `${pair.aId}-keep-a`
                            ? 'Delete the other?'
                            : 'Keep only this'}
                        </Button>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1 pr-3 font-mono">{pair.bWCode}</td>
                      <td className="py-1 pr-3">
                        {pair.bName}
                        {pair.bVintage ? ` ${pair.bVintage}` : ''}
                      </td>
                      <td className="py-1 pr-3 text-right tabular-nums">
                        {pair.bLines}
                      </td>
                      <td className="py-1 pr-3 text-right tabular-nums">
                        {Math.round(pair.bBottles)}
                      </td>
                      <td className="py-1 text-right">
                        <span className="flex items-center justify-end gap-1">
                          <Button
                            size="xs"
                            colorRole={
                              confirmingMerge === `${pair.bId}-keep-b`
                                ? 'danger'
                                : 'muted'
                            }
                            variant="outline"
                            isDisabled={mergeSkus.isPending}
                            onClick={() => {
                              const key = `${pair.bId}-keep-b`;
                              if (confirmingMerge !== key) {
                                setConfirmingMerge(key);
                                return;
                              }
                              mergeSkus.mutate({
                                fromSkuId: pair.aId,
                                intoSkuId: pair.bId,
                              });
                              setConfirmingMerge(null);
                            }}
                          >
                            {confirmingMerge === `${pair.bId}-keep-b`
                              ? 'Delete the other?'
                              : 'Keep only this'}
                          </Button>
                          <Button
                            size="xs"
                            colorRole="muted"
                            variant="ghost"
                            onClick={() => keepBoth(`${pair.aId}-${pair.bId}`)}
                          >
                            Keep both
                          </Button>
                        </span>
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <Typography variant="bodyXs" colorRole="muted" asChild>
        <p>
          The WMS already stores Crurated&rsquo;s W codes against received stock
          (<span className="font-mono">wms_stock.supplier_sku</span>), so the
          registry can be seeded from real warehouse data. Existing SKUs are left
          untouched — safe to re-run after each shipment.
        </p>
      </Typography>

      {rows.length === 0 ? (
        <Typography variant="bodySm" colorRole="muted">
          No SKUs yet. Import from the WMS, or create them as you resolve codes on
          the Mapping tab.
        </Typography>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-text-muted border-border-primary border-b">
              <tr>
                <th className="py-2 pr-3">W code</th>
                <th className="py-2 pr-3">Product</th>
                <th className="py-2 pr-3">Vintage</th>
                <th className="py-2 pr-3 text-right">Bottles/case</th>
                <th className="py-2 pr-3">Mapped codes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((sku) => (
                <tr key={sku.id} className="border-border-primary border-b align-top">
                  <td className="py-2 pr-3 font-mono">{sku.wCode}</td>
                  <td className="py-2 pr-3">
                    {sku.productName}
                    {sku.producer ? (
                      <span className="text-text-muted block text-xs">
                        {sku.producer}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{sku.vintage ?? '—'}</td>
                  <td className="py-2 pr-3 text-right">
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={packEdits[sku.id] ?? sku.caseConfig}
                      onChange={(event) =>
                        setPackEdits((current) => ({
                          ...current,
                          [sku.id]: Number(event.target.value),
                        }))
                      }
                      onBlur={(event) => {
                        const next = Number(event.target.value);

                        if (!next || next === sku.caseConfig) {
                          return;
                        }

                        upsertSku.mutate({
                          skuId: sku.id,
                          wCode: sku.wCode,
                          lwin18: sku.lwin18,
                          productName: sku.productName,
                          producer: sku.producer,
                          vintage: sku.vintage,
                          bottleSize: sku.bottleSize,
                          caseConfig: next,
                          notes: sku.notes,
                        });
                      }}
                      className="border-border-primary bg-fill-primary w-20 rounded-md border px-2 py-1 text-right text-sm tabular-nums"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap gap-1">
                      {sku.aliases.length === 0 ? (
                        <Typography variant="bodyXs" colorRole="muted">
                          none
                        </Typography>
                      ) : (
                        sku.aliases.map((alias) => (
                          <Badge
                            key={alias.id}
                            size="xs"
                            colorRole={alias.source === 'city_drinks' ? 'info' : 'muted'}
                          >
                            <span className="font-mono">{alias.aliasCode}</span>
                            <button
                              type="button"
                              aria-label={`Remove mapping ${alias.aliasCode}`}
                              className="ml-1 opacity-60 hover:opacity-100"
                              onClick={() => deleteAlias.mutate({ aliasId: alias.id })}
                            >
                              <IconX className="size-3" />
                            </button>
                          </Badge>
                        ))
                      )}
                    </div>
                    {/* Mapping was only reachable from the unmapped queue, so a
                        code already sitting on the wrong SKU had no route back
                        — the commonest case, since both sides are technically
                        resolved. Typing it here moves it, whatever holds it. */}
                    <form
                      className="mt-1.5 flex gap-1"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const code = (codeDrafts[sku.id] ?? '').trim();

                        if (!code) return;

                        moveCode.mutate({
                          normalizedCode: code
                            .toUpperCase()
                            .replace(/[^A-Z0-9]/g, ''),
                          skuId: sku.id,
                        });
                        setCodeDrafts((current) => ({
                          ...current,
                          [sku.id]: '',
                        }));
                      }}
                    >
                      <input
                        value={codeDrafts[sku.id] ?? ''}
                        onChange={(event) =>
                          setCodeDrafts((current) => ({
                            ...current,
                            [sku.id]: event.target.value,
                          }))
                        }
                        placeholder="Add a code"
                        aria-label={`Add a code to ${sku.wCode}`}
                        className="border-border-primary bg-fill-primary min-h-7 w-40 rounded-md border px-2 font-mono text-xs"
                      />
                      <Button
                        size="xs"
                        colorRole="brand"
                        variant="outline"
                        type="submit"
                        isDisabled={
                          moveCode.isPending || !(codeDrafts[sku.id] ?? '').trim()
                        }
                      >
                        Map
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SkusTab;
