'use client';

import { IconDownload } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import type { ZohoCleanupRow } from '../controller/adminGetZohoCleanup';

/** Which rows are worth showing while the work is being done */
type Filter = 'todo' | 'unresolved' | 'all';

/**
 * The worklist for correcting the Zoho item master
 *
 * The alias table can absorb any amount of code history, so the reconciliation
 * can be made to read correctly on the codes as they stand. What it cannot do
 * is stop the mess regrowing: every invoice is raised against the same Zoho
 * item and carries the same wrong code and the same wrong pack size back in.
 *
 * This is the other half of the job — a list of every Zoho code carrying
 * invoiced bottles, what it should become, and how much rides on it. Ordered by
 * bottles, because a code on one bottle and a code on four hundred do not
 * deserve the same afternoon.
 */
const ZohoCleanupTab = () => {
  const api = useTRPC();

  const [filter, setFilter] = useState<Filter>('todo');
  const [search, setSearch] = useState('');

  const cleanup = useQuery(api.triangulation.admin.getZohoCleanup.queryOptions());

  const allRows = cleanup.data?.rows ?? [];
  const summary = cleanup.data?.summary;

  const term = search.trim().toLowerCase();

  const rows = allRows
    .filter((row) => {
      if (filter === 'todo') return !row.isStandard && row.isMapped;
      if (filter === 'unresolved') return !row.isMapped;
      return true;
    })
    .filter((row) =>
      term
        ? [row.currentCode, row.description, row.wCode, row.productName]
            .filter(Boolean)
            .some((field) => field?.toLowerCase().includes(term))
        : true,
    );

  /**
   * The list as a file, because the work happens in Zoho rather than here and
   * a screen cannot be worked through line by line beside another system.
   */
  const download = () => {
    const escape = (value: string | number | null) => {
      const text = String(value ?? '');
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    const csv = [
      [
        'Current Zoho code',
        'Description',
        'Change to (C&C LWIN)',
        'W code',
        'Wine',
        'Invoice lines',
        'Bottles',
        'Status',
        'Invoices',
      ].join(','),
      ...rows.map((row) =>
        [
          row.currentCode,
          row.description,
          row.targetLwin18,
          row.wCode,
          row.productName,
          row.lines,
          row.bottles,
          row.isStandard
            ? 'Already standard'
            : row.isMapped
              ? 'Rename to the LWIN'
              : 'Map it first — no target yet',
          row.docRefs.join(' '),
        ]
          .map(escape)
          .join(','),
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

  const statusOf = (row: ZohoCleanupRow) => {
    if (row.isStandard) {
      return { label: 'Standard', colorRole: 'success' as const };
    }

    return row.isMapped
      ? { label: 'Rename', colorRole: 'warning' as const }
      : { label: 'Map first', colorRole: 'danger' as const };
  };

  return (
    <div className="space-y-4">
      <div className="border-border-primary bg-fill-muted/20 rounded-xl border p-4">
        <Typography variant="labelSm">Fixing Zoho at source</Typography>
        <Typography variant="bodyXs" colorRole="muted" asChild>
          <p className="mt-1 max-w-3xl">
            Mapping makes today&rsquo;s figures right. It does not stop the mess
            regrowing — the next invoice is raised against the same Zoho item
            and brings the same code and pack size back with it. Renaming each
            item to its dashed C&amp;C LWIN is what ends that, and everything
            already mapped here tells you exactly what to rename it to.
          </p>
        </Typography>

        {summary ? (
          <div className="mt-3 flex flex-wrap gap-4">
            {[
              {
                label: 'Already standard',
                value: summary.standard,
                hint: 'nothing to do',
              },
              {
                label: 'Ready to rename',
                value: summary.renameable,
                hint: 'target LWIN known',
              },
              {
                label: 'Map first',
                value: summary.unresolved,
                hint: 'no W code yet',
              },
              {
                label: 'Bottles on wrong codes',
                value: Math.round(summary.bottlesOnNonStandard),
                hint: 'what is exposed',
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
            { value: 'todo', label: 'To rename' },
            { value: 'unresolved', label: 'Map first' },
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
            placeholder="Search code, wine or W code…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Typography variant="bodySm" colorRole="muted">
          {rows.length} shown
        </Typography>
        <Button
          size="sm"
          colorRole="muted"
          variant="outline"
          isDisabled={rows.length === 0}
          onClick={download}
        >
          <IconDownload className="mr-1 size-4" />
          Download list
        </Button>
      </div>

      {cleanup.isLoading ? (
        <Typography variant="bodySm" colorRole="muted">
          Reading the Zoho codes in use…
        </Typography>
      ) : rows.length === 0 ? (
        <div className="border-border-primary rounded-xl border p-8 text-center">
          <Typography variant="labelSm" colorRole="success">
            Nothing in this view.
          </Typography>
          <Typography variant="bodySm" colorRole="muted" asChild>
            <p className="mt-1">
              {filter === 'todo'
                ? 'Every mapped Zoho code is already the dashed C&C LWIN.'
                : 'Try another filter.'}
            </p>
          </Typography>
        </div>
      ) : (
        <div className="border-border-primary overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="text-text-muted bg-fill-muted/20 sticky top-0">
              <tr>
                <th className="px-3 py-2 font-medium">Zoho code today</th>
                <th className="px-3 py-2 font-medium">Change it to</th>
                <th className="px-3 py-2 font-medium">Wine</th>
                <th className="px-3 py-2 text-right font-medium">Lines</th>
                <th className="px-3 py-2 text-right font-medium">Bottles</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const status = statusOf(row);

                return (
                  <tr
                    key={`${row.currentCode}-${row.wCode}`}
                    className="border-border-primary border-t align-top"
                  >
                    <td className="px-3 py-2 font-mono text-xs">
                      {row.currentCode ?? '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {row.targetLwin18 ?? (
                        <span className="text-text-muted font-sans">
                          no LWIN on the SKU
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.productName ?? row.description}
                      {row.wCode ? (
                        <span className="text-text-muted block font-mono text-xs">
                          {row.wCode}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.lines}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.bottles.toLocaleString('en-GB')}
                    </td>
                    <td className="px-3 py-2">
                      <Badge size="xs" colorRole={status.colorRole}>
                        {status.label}
                      </Badge>
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
};

export default ZohoCleanupTab;
