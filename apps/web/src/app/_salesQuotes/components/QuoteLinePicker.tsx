'use client';

import { IconPlus, IconSearch } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import type { QuoteLineDraft } from '../types';

export interface QuoteLinePickerProps {
  /** LWIN18s already on the quote, so they can be marked as added */
  chosen: Set<string>;
  onAdd: (line: QuoteLineDraft) => void;
}

const sizeToCl = (bottleSize: string | null) => {
  if (!bottleSize) return 75;
  const ml = Number(String(bottleSize).replace(/[^\d.]/g, ''));
  if (!ml) return 75;
  // the catalogue writes both "75cl" and "750ml"
  return /ml/i.test(bottleSize) ? Math.round(ml / 10) : Math.round(ml);
};

/**
 * Searchable picker for the lines a quote can be built from.
 *
 * Sourced from the same catalogue data as /price-list-beta, so a quote is
 * priced from the numbers the client sees on the price list. Held stock and
 * in-transit shipments are separate lists because they mean different things
 * to a buyer — an inbound line is added straight into the quote's Inbound
 * section so it can never be presented as available now.
 */
const QuoteLinePicker = ({ chosen, onAdd }: QuoteLinePickerProps) => {
  const api = useTRPC();
  const [search, setSearch] = useState('');
  const [stock, setStock] = useState<'held' | 'inbound'>('held');

  const { data, isFetching } = useQuery(
    api.salesQuotes.admin.selectableLines.queryOptions({
      search: search.trim() || undefined,
      stock,
    }),
  );

  const rows = data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="min-w-56 flex-1"
          iconLeft={IconSearch}
          placeholder="Search wine, producer or LWIN…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="flex gap-1">
          {(['held', 'inbound'] as const).map((value) => (
            <Button
              key={value}
              size="sm"
              colorRole={stock === value ? 'brand' : 'muted'}
              variant={stock === value ? 'default' : 'outline'}
              onClick={() => setStock(value)}
            >
              {value === 'held' ? 'In UAE' : 'Inbound'}
            </Button>
          ))}
        </div>
      </div>

      <Typography variant="bodyXs" colorRole="muted" asChild>
        <p>
          {isFetching
            ? 'Searching…'
            : `${rows.length} reference${rows.length === 1 ? '' : 's'} with stock`}
        </p>
      </Typography>

      <div className="max-h-96 divide-y divide-border-muted overflow-y-auto rounded-lg border border-border-muted">
        {rows.map((row) => {
          const added = chosen.has(row.lwin18);
          const cl = sizeToCl(row.bottleSize);

          return (
            <div
              key={`${row.lwin18}-${row.inbound ? 'in' : 'held'}`}
              className="flex items-center gap-3 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <Typography variant="bodySm" asChild>
                  <p className="truncate">
                    {row.product}{' '}
                    <span className="text-text-muted">{row.vintage ?? 'NV'}</span>
                  </p>
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" asChild>
                  <p>
                    {row.caseConfig} × {cl >= 100 ? `${cl / 100}L` : `${cl}cl`} ·{' '}
                    {row.availableBottles} btl · ${row.ibPerBottle.toFixed(2)}/btl
                    {row.owner ? ` · ${row.owner}` : ''}
                  </p>
                </Typography>
              </div>

              {row.inbound ? <Badge colorRole="info">Inbound</Badge> : null}

              <Button
                size="sm"
                colorRole={added ? 'muted' : 'brand'}
                variant={added ? 'outline' : 'default'}
                isDisabled={added}
                onClick={() =>
                  onAdd({
                    lwin18: row.lwin18,
                    wine: row.product,
                    vintage: String(row.vintage ?? ''),
                    size: cl,
                    pack: row.caseConfig || 1,
                    avail: row.availableBottles,
                    qty: 0,
                    busd: row.ibPerBottle,
                    cusd: row.ibPerCase,
                    region: row.inbound
                      ? 'Inbound — In Transit'
                      : row.region || 'Other',
                  })
                }
              >
                {added ? (
                  'Added'
                ) : (
                  <>
                    <IconPlus className="mr-1 size-3.5" />
                    Add
                  </>
                )}
              </Button>
            </div>
          );
        })}

        {!rows.length && !isFetching ? (
          <div className="px-3 py-8 text-center">
            <Typography variant="bodySm" colorRole="muted" asChild>
              <p>No references match that search.</p>
            </Typography>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default QuoteLinePicker;
