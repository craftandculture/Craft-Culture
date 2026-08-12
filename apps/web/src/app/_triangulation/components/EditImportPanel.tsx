'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import SelectField from './SelectField';
import type { TriImportRow } from '../controller/adminGetImports';
import type { TriAliasSource, TriImportKind } from '../schemas/triangulationSchemas';
import importKindLabels from '../utils/importKindLabels';

export interface EditImportPanelProps {
  record: TriImportRow;
  onClose: () => void;
}

const KIND_ORDER: TriImportKind[] = [
  'cc_opening',
  'cc_sales_to_cd',
  'cc_count',
  'cd_sales',
  'cd_count',
];

const ALIAS_SOURCES: { value: TriAliasSource; label: string }[] = [
  { value: 'city_drinks', label: 'City Drinks (CD codes)' },
  { value: 'crurated', label: 'Owner / internal (W codes)' },
  { value: 'zoho', label: 'Zoho item codes' },
  { value: 'packing_list', label: 'Packing list codes' },
  { value: 'other', label: 'Other' },
];

/**
 * Correct an import that was uploaded with the wrong settings
 *
 * Re-uploading would discard the code mappings already resolved against the
 * file, so the settings are amended in place and the lines recomputed. The
 * usual repair is the unit: a file read as bottles that was really cases.
 */
const EditImportPanel = ({ record, onClose }: EditImportPanelProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const [kind, setKind] = useState<TriImportKind>(record.kind);
  const [periodId, setPeriodId] = useState<string>(record.periodId ?? '');
  const [asOfDate, setAsOfDate] = useState(record.asOfDate);
  const [aliasSource, setAliasSource] = useState<TriAliasSource>(
    record.aliasSource as TriAliasSource,
  );
  const [unit, setUnit] = useState<'bottle' | 'case'>(
    record.unit === 'case' ? 'case' : 'bottle',
  );
  // Deliberately not pre-filled from the record. This field overwrites the pack
  // size on every line, so it stays blank and opt-in — otherwise saving an
  // unrelated edit would flatten pack sizes the source file supplied per line.
  const [caseConfig, setCaseConfig] = useState('');

  const periods = useQuery(api.triangulation.admin.getPeriods.queryOptions());

  const updateImport = useMutation({
    ...api.triangulation.admin.updateImport.mutationOptions(),
    onSuccess: async (result) => {
      const unmapped = result.rowCount - result.mappedRowCount;

      toast.success(
        `Updated — ${Math.round(result.totalBottles).toLocaleString('en-GB')} bottles` +
          (unmapped > 0 ? `, ${unmapped} rows still unmapped` : ''),
      );

      await queryClient.invalidateQueries({
        queryKey: api.triangulation.admin.getImports.queryKey(),
      });
      await queryClient.invalidateQueries({
        queryKey: api.triangulation.admin.getTriangulation.queryKey(),
      });
      await queryClient.invalidateQueries({
        queryKey: api.triangulation.admin.getUnmapped.queryKey(),
      });

      onClose();
    },
    onError: (error) => toast.error(error.message),
  });

  const unitChanged = unit !== (record.unit === 'case' ? 'case' : 'bottle');
  const isMixedUnit = record.unit?.includes('/') ?? false;

  return (
    <div className="border-border-primary rounded-2xl border p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Typography variant="headingSm" asChild>
            <h3>Edit import</h3>
          </Typography>
          <Typography variant="bodySm" colorRole="muted" asChild>
            <p className="mt-1">
              {record.fileName ?? record.sourceRef ?? 'Uploaded file'} ·{' '}
              {record.rowCount} rows · currently{' '}
              {Math.round(record.totalBottles).toLocaleString('en-GB')} bottles
            </p>
          </Typography>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField
          label="Input"
          value={kind}
          onChange={(event) => setKind(event.target.value as TriImportKind)}
        >
          {KIND_ORDER.map((option) => (
            <option key={option} value={option}>
              {importKindLabels[option].label}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Period"
          value={periodId}
          onChange={(event) => setPeriodId(event.target.value)}
        >
          <option value="">No period (all time)</option>
          {(periods.data ?? []).map((period) => (
            <option key={period.id} value={period.id}>
              {period.label}
              {period.status === 'locked' ? ' · locked' : ''}
            </option>
          ))}
        </SelectField>

        <label className="flex flex-col gap-1">
          <span className="text-text-muted text-xs font-medium tracking-tight">
            As at
          </span>
          <input
            type="date"
            value={asOfDate}
            onChange={(event) => setAsOfDate(event.target.value)}
            className="border-border-primary bg-fill-primary text-text-primary focus:ring-border-primary min-h-9 rounded-lg border border-b-2 px-2.5 text-sm font-medium focus:outline-none focus:ring-2"
          />
        </label>

        <SelectField
          label="Quantities are in"
          value={unit}
          onChange={(event) => setUnit(event.target.value as 'bottle' | 'case')}
        >
          <option value="bottle">Bottles</option>
          <option value="case">Cases</option>
        </SelectField>

        <label className="flex flex-col gap-1">
          <span className="text-text-muted text-xs font-medium tracking-tight">
            Force bottles per case
          </span>
          <input
            type="number"
            min={1}
            max={120}
            placeholder="leave blank to keep as-is"
            value={caseConfig}
            onChange={(event) => setCaseConfig(event.target.value)}
            className="border-border-primary bg-fill-primary text-text-primary focus:ring-border-primary min-h-9 rounded-lg border border-b-2 px-2.5 text-sm font-medium focus:outline-none focus:ring-2"
          />
        </label>

        <SelectField
          label="Codes in this file are"
          value={aliasSource}
          onChange={(event) => setAliasSource(event.target.value as TriAliasSource)}
        >
          {ALIAS_SOURCES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
      </div>

      {isMixedUnit ? (
        <Typography variant="bodyXs" colorRole="warning" asChild>
          <p className="mt-3">
            This import currently holds a mix of bottle and case lines. Saving
            applies the choice above to every line.
          </p>
        </Typography>
      ) : null}

      {unitChanged ? (
        <Typography variant="bodyXs" colorRole="warning" asChild>
          <p className="mt-3">
            Changing the unit reinterprets all {record.rowCount} lines and
            recomputes the bottle figures.{' '}
            {unit === 'case'
              ? 'Quantities will be multiplied by the pack size.'
              : 'Quantities will be taken as bottles as-is.'}
          </p>
        </Typography>
      ) : null}

      <Typography variant="bodyXs" colorRole="muted" asChild>
        <p className="mt-3">
          Code mappings already resolved against this file are kept — the lines
          are re-matched after saving.
        </p>
      </Typography>

      <div className="mt-4 flex justify-end gap-2">
        <Button colorRole="muted" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          colorRole="brand"
          isDisabled={updateImport.isPending || !asOfDate}
          onClick={() =>
            updateImport.mutate({
              importId: record.id,
              kind,
              periodId: periodId || null,
              asOfDate,
              aliasSource,
              unit,
              caseConfigOverride: caseConfig ? Number(caseConfig) : undefined,
            })
          }
        >
          {updateImport.isPending ? 'Saving…' : 'Save and recalculate'}
        </Button>
      </div>
    </div>
  );
};

export default EditImportPanel;
