'use client';

import { IconLink, IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import SelectField from './SelectField';
import type { TriAliasSource } from '../schemas/triangulationSchemas';
import type { TriImportKind } from '../schemas/triangulationSchemas';
import importKindLabels from '../utils/importKindLabels';


/**
 * Resolve the product codes the triangulation could not attribute
 *
 * Each row here is real stock movement sitting outside the figures — a CD code
 * with no W code behind it. Mapping one writes an alias, which then resolves
 * that code in every import that already used it, past months included.
 */
const MappingTab = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState<Record<string, string>>({});

  const unmapped = useQuery(
    api.triangulation.admin.getUnmapped.queryOptions({ importId: null, limit: 200 }),
  );

  const skus = useQuery(
    api.triangulation.admin.getSkus.queryOptions({ search, limit: 500 }),
  );

  const mapAlias = useMutation({
    ...api.triangulation.admin.mapAlias.mutationOptions(),
    onSuccess: async (result) => {
      toast.success(
        `Mapped — ${result.remappedImports} import${
          result.remappedImports === 1 ? '' : 's'
        } re-checked`,
      );

      await queryClient.invalidateQueries({
        queryKey: api.triangulation.admin.getUnmapped.queryKey(),
      });
      await queryClient.invalidateQueries({
        queryKey: api.triangulation.admin.getTriangulation.queryKey(),
      });
      await queryClient.invalidateQueries({
        queryKey: api.triangulation.admin.getSkus.queryKey(),
      });
      await queryClient.invalidateQueries({
        queryKey: api.triangulation.admin.getImports.queryKey(),
      });
    },
    onError: (error) => toast.error(error.message),
  });

  const createSku = useMutation({
    ...api.triangulation.admin.upsertSku.mutationOptions(),
    onError: (error) => toast.error(error.message),
  });

  const rows = unmapped.data ?? [];
  const skuOptions = skus.data ?? [];

  const handleMap = (
    normalizedCode: string,
    rawCode: string | null,
    rawDescription: string | null,
    aliasSource: string,
    skuId: string,
  ) => {
    mapAlias.mutate({
      skuId,
      source: aliasSource as TriAliasSource,
      aliasCode: rawCode ?? normalizedCode,
      aliasName: rawDescription,
      applyToExistingLines: true,
    });
  };

  const handleCreateAndMap = async (row: (typeof rows)[number]) => {
    const wCode = row.rawCode ?? row.normalizedCode;

    const created = await createSku.mutateAsync({
      wCode,
      productName: row.rawDescription ?? wCode,
      vintage: row.rawVintage ? Number(row.rawVintage) || null : null,
      caseConfig: 6,
    });

    if (!created.id) {
      return;
    }

    handleMap(
      row.normalizedCode,
      row.rawCode,
      row.rawDescription,
      row.aliasSource,
      created.id,
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 grow">
          <Typography variant="labelXs" colorRole="muted" asChild>
            <p className="mb-1">Filter the W code list</p>
          </Typography>
          <Input
            placeholder="Search W code, producer or wine…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Typography variant="bodySm" colorRole="muted">
          {rows.length} unresolved code{rows.length === 1 ? '' : 's'}
        </Typography>
      </div>

      {rows.length === 0 ? (
        <div className="border-border-primary rounded-xl border p-8 text-center">
          <Typography variant="labelSm" colorRole="success">
            Every imported code resolves to a W code.
          </Typography>
          <Typography variant="bodySm" colorRole="muted" asChild>
            <p className="mt-1">
              The reconciliation accounts for all imported movement.
            </p>
          </Typography>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={`${row.aliasSource}-${row.normalizedCode}`}
              className="border-border-primary rounded-xl border p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Typography variant="labelSm" asChild>
                      <span className="font-mono">{row.rawCode ?? row.normalizedCode}</span>
                    </Typography>
                    <Badge size="xs" colorRole="muted">
                      {row.aliasSource.replace('_', ' ')}
                    </Badge>
                    {row.kinds.map((kind) => (
                      <Badge key={kind} size="xs" colorRole="info">
                        {importKindLabels[kind as TriImportKind]?.shortLabel ?? kind}
                      </Badge>
                    ))}
                  </div>
                  <Typography variant="bodySm" colorRole="muted" asChild>
                    <p className="mt-1">
                      {row.rawDescription ?? 'No description in the source file'}
                      {row.rawVintage ? ` · ${row.rawVintage}` : ''}
                    </p>
                  </Typography>
                  <Typography variant="bodyXs" colorRole="warning" asChild>
                    <p className="mt-1">
                      {row.lineCount} line{row.lineCount === 1 ? '' : 's'} ·{' '}
                      {Math.round(row.totalQuantity).toLocaleString('en-GB')} bottles
                      outside the figures
                    </p>
                  </Typography>
                </div>

                <div className="flex flex-wrap items-end gap-2">
                  <SelectField
                    label="Map to W code"
                    value={selection[row.normalizedCode] ?? ''}
                    onChange={(event) =>
                      setSelection((current) => ({
                        ...current,
                        [row.normalizedCode]: event.target.value,
                      }))
                    }
                  >
                    <option value="">— choose a SKU —</option>
                    {skuOptions.map((sku) => (
                      <option key={sku.id} value={sku.id}>
                        {sku.wCode} · {sku.productName}
                        {sku.vintage ? ` ${sku.vintage}` : ''}
                      </option>
                    ))}
                  </SelectField>
                  <Button
                    size="sm"
                    colorRole="brand"
                    isDisabled={!selection[row.normalizedCode] || mapAlias.isPending}
                    onClick={() =>
                      handleMap(
                        row.normalizedCode,
                        row.rawCode,
                        row.rawDescription,
                        row.aliasSource,
                        selection[row.normalizedCode] ?? '',
                      )
                    }
                  >
                    <IconLink className="mr-1 size-4" />
                    Map
                  </Button>
                  <Button
                    size="sm"
                    colorRole="muted"
                    variant="outline"
                    isDisabled={createSku.isPending || mapAlias.isPending}
                    onClick={() => void handleCreateAndMap(row)}
                  >
                    <IconPlus className="mr-1 size-4" />
                    New SKU
                  </Button>
                </div>
              </div>

              {row.suggestions.length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Typography variant="bodyXs" colorRole="muted">
                    Suggested:
                  </Typography>
                  {row.suggestions.map((suggestion) => (
                    <Button
                      key={suggestion.id}
                      size="xs"
                      colorRole="muted"
                      variant="outline"
                      isDisabled={mapAlias.isPending}
                      onClick={() =>
                        handleMap(
                          row.normalizedCode,
                          row.rawCode,
                          row.rawDescription,
                          row.aliasSource,
                          suggestion.id,
                        )
                      }
                    >
                      {suggestion.wCode} · {suggestion.productName}
                      {suggestion.vintage ? ` ${suggestion.vintage}` : ''}
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MappingTab;
