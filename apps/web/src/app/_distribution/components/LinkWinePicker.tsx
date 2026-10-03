'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';

import describeLwin18 from '../utils/describeLwin18';

export interface LinkWinePickerProps {
  outletId: string;
  outletCode: string;
  productName: string;
  onLinked: () => void;
  onCancel: () => void;
}

/**
 * Link one of the outlet's codes to one of our wines, from where it is seen
 *
 * Searches the catalogue starting from the outlet's own name for the wine, so
 * the likely answer is usually already on screen, and saves the link as a
 * confirmed one — a person chose it. The vintage and format are shown beside
 * each hit, because the catalogue name alone does not carry them.
 */
const LinkWinePicker = ({ outletId, outletCode, productName, onLinked, onCancel }: LinkWinePickerProps) => {
  const api = useTRPC();
  const [term, setTerm] = useState(productName.replace(/\b(19|20)\d{2}\b/g, '').trim().slice(0, 60));

  const hits = useQuery({
    ...api.distribution.admin.searchWines.queryOptions({ term: term.trim(), outletId }),
    enabled: term.trim().length >= 2,
  });

  const link = useMutation({
    ...api.distribution.admin.linkCode.mutationOptions(),
    onSuccess: () => {
      toast.success(`Linked ${productName}`);
      onLinked();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="border-border-brand bg-fill-brand/5 space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={`link-${outletCode}`}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search our wines by name, producer or LWIN"
          className="border-border-primary bg-fill-primary text-text-primary min-h-9 flex-1 rounded-md border px-2 text-sm"
          autoFocus
        />
        <button type="button" onClick={onCancel} className="text-text-muted text-xs hover:underline">
          Cancel
        </button>
      </div>
      <p className="text-text-muted text-xs">
        Their name: {productName} · {outletCode}
      </p>
      {hits.isFetching ? <p className="text-text-muted text-xs">Searching…</p> : null}
      {hits.data && hits.data.wines.length === 0 ? (
        <p className="text-text-muted text-xs">No wine of ours matches. Try the producer, or fewer words.</p>
      ) : null}
      <div className="divide-border-primary max-h-64 divide-y overflow-y-auto">
        {(hits.data?.wines ?? []).map((hit) => (
          <button
            key={hit.lwin18}
            type="button"
            disabled={link.isPending}
            onClick={() =>
              link.mutate({
                outletId,
                outletCode,
                lwin18: hit.lwin18,
                outletProductName: productName,
                ourProductName: hit.productName,
              })
            }
            className="hover:bg-fill-muted/50 flex w-full items-center justify-between gap-3 px-2 py-2 text-left text-sm"
          >
            <span className="min-w-0">
              <span className="text-text-primary block truncate">{hit.productName}</span>
              <span className="text-text-muted block text-xs">
                {describeLwin18(hit.lwin18) ?? hit.lwin18}
                {hit.producer ? ` · ${hit.producer}` : ''}
              </span>
            </span>
            <span className="text-text-muted shrink-0 text-xs">
              {hit.ownerName ? `${hit.ownerName} · ${hit.outBottles} out` : 'Link'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default LinkWinePicker;
