'use client';

import { IconAlertTriangle } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import formatBottles from '../utils/formatBottles';

export interface DuplicatePanelProps {
  importId: string;
}

/**
 * The lines in a draft import that appear to restate committed stock
 *
 * Shown before committing rather than reported after, because a doubled
 * receipt is invisible downstream: the figures stay plausible and simply
 * overstate what arrived. Each row is put beside the record it collides with,
 * so the call — same shipment twice, or a genuine repeat order — can be made
 * on the evidence rather than on the warning alone.
 */
const DuplicatePanel = ({ importId }: DuplicatePanelProps) => {
  const api = useTRPC();

  const duplicates = useQuery(
    api.triangulation.admin.getDuplicateWarnings.queryOptions({ importId }),
  );

  if (!duplicates.data || duplicates.data.count === 0) {
    return null;
  }

  return (
    <div className="border-border-warning/40 bg-fill-warning/10 mt-2 rounded-lg border p-3">
      <div className="flex items-start gap-2">
        <IconAlertTriangle className="text-text-warning mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <Typography variant="labelSm" colorRole="warning">
            {duplicates.data.count} line
            {duplicates.data.count === 1 ? '' : 's'} match stock already
            committed — {formatBottles(duplicates.data.bottles)} bottles
          </Typography>
          <Typography variant="bodyXs" colorRole="muted" asChild>
            <p className="mt-0.5">
              The same shipment often arrives twice: once on a supplier invoice
              and once on an opening-stock sheet. Committing both doubles the
              receipt.
            </p>
          </Typography>

          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-text-muted">
                <tr>
                  <th className="py-1 pr-3 font-medium">Product</th>
                  <th className="py-1 pr-3 text-right font-medium">Bottles</th>
                  <th className="py-1 pr-3 font-medium">This import</th>
                  <th className="py-1 font-medium">Already committed</th>
                </tr>
              </thead>
              <tbody>
                {duplicates.data.lines.map((line) => (
                  <tr key={line.lineId} className="border-border-warning/20 border-t">
                    <td className="max-w-64 truncate py-1 pr-3" title={line.description ?? ''}>
                      {line.description ?? '—'}
                    </td>
                    <td className="py-1 pr-3 text-right tabular-nums">
                      {formatBottles(line.quantityBottles)}
                    </td>
                    <td className="text-text-muted py-1 pr-3">
                      {line.lineDate}
                      {line.docRef ? ` · ${line.docRef}` : ''}
                    </td>
                    <td className="text-text-muted py-1">
                      {line.matchDate}
                      {line.matchDocRef ? ` · ${line.matchDocRef}` : ''}
                      {line.matchFileName ? ` · ${line.matchFileName}` : ''}
                      <span className="ml-1">({line.daysApart}d apart)</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DuplicatePanel;
