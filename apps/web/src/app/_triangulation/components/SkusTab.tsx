'use client';

import { IconDatabaseImport, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fragment, useState } from 'react';
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
const SkusTab = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [packEdits, setPackEdits] = useState<Record<string, number>>({});

  const splits = useQuery(api.triangulation.admin.findSplitSkus.queryOptions());

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

      {(splits.data?.length ?? 0) > 0 ? (
        <div className="border-border-warning/40 bg-fill-warning/10 rounded-xl border p-4">
          <Typography variant="labelSm" colorRole="warning">
            {splits.data?.length} pair
            {splits.data?.length === 1 ? '' : 's'} of SKUs look like the same wine
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
                </tr>
              </thead>
              <tbody>
                {splits.data?.map((pair) => (
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
