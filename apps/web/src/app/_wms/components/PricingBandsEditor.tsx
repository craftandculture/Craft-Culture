'use client';

import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';

export interface PricingBandsEditorProps {
  /** Whose tiers to edit; null edits the house tiers used by every owner. */
  ownerId?: string | null;
  /** Shown so it is obvious whose rates are being changed. */
  ownerName?: string | null;
  onClose: () => void;
}

interface BandDraft {
  minLandedPerBottle: number;
  maxLandedPerBottle: number | null;
  b2bMarginPct: number;
  pcMarginPct: number;
}

/**
 * Edit the margin tiers: what to charge over landed cost, by what the wine cost.
 *
 * The whole set saves together, so what is on screen is what prices the book —
 * a half-saved set would leave a cost range with no tier and quietly fall back
 * to the flat rate.
 */
const PricingBandsEditor = ({
  ownerId = null,
  ownerName,
  onClose,
}: PricingBandsEditorProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<BandDraft[]>([]);

  const { data, isLoading } = useQuery(
    api.wms.admin.stock.pricing.getBands.queryOptions({ ownerId }),
  );

  useEffect(() => {
    if (!data?.bands) return;
    setRows(
      data.bands.map((band) => ({
        minLandedPerBottle: band.minLandedPerBottle,
        maxLandedPerBottle: band.maxLandedPerBottle,
        b2bMarginPct: band.b2bMarginPct,
        pcMarginPct: band.pcMarginPct,
      })),
    );
  }, [data]);

  const saveMutation = useMutation({
    ...api.wms.admin.stock.pricing.setBands.mutationOptions(),
    onSuccess: (result) => {
      toast.success(
        `${result.saved} tier${result.saved === 1 ? '' : 's'} saved`,
      );
      void queryClient.invalidateQueries();
      onClose();
    },
    onError: (error) => toast.error(`Could not save: ${error.message}`),
  });

  const update = (index: number, patch: Partial<BandDraft>) =>
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );

  // A tier whose top is below its bottom, or a margin at 100%, would price
  // nothing or divide by zero — say so before it can be saved.
  const problems = rows
    .map((row, i) => {
      if (row.maxLandedPerBottle != null && row.maxLandedPerBottle <= row.minLandedPerBottle) {
        return `Tier ${i + 1}: the top must be above the bottom`;
      }
      if (row.b2bMarginPct >= 100 || row.pcMarginPct >= 100) {
        return `Tier ${i + 1}: a margin must be under 100%`;
      }
      return null;
    })
    .filter((problem): problem is string => problem !== null);

  const priceAt = (landed: number, pct: number) =>
    pct >= 100 ? 0 : landed / (1 - pct / 100);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-3xl rounded-xl border border-border-primary bg-fill-primary p-5 shadow-xl">
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold">
            Margin tiers{ownerName ? ` — ${ownerName}` : ''}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-text-muted hover:text-text-primary"
          >
            Close
          </button>
        </div>
        <p className="mb-4 text-[13px] text-text-muted">
          The margin taken over landed cost, chosen by what the bottle cost.
          Price = landed ÷ (1 − margin). A per-wine override always wins over a
          tier.
        </p>

        {isLoading ? (
          <p className="py-8 text-center text-sm text-text-muted">Loading…</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-muted text-left text-[11px] uppercase tracking-wide text-text-muted">
                    <th className="py-2 pr-3 font-medium">Landed from</th>
                    <th className="py-2 pr-3 font-medium">to</th>
                    <th className="py-2 pr-3 text-right font-medium">B2B %</th>
                    <th className="py-2 pr-3 text-right font-medium">PC %</th>
                    <th className="py-2 pr-3 text-right font-medium">
                      Example at the bottom of the tier
                    </th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-muted">
                  {rows.map((row, index) => (
                    <tr key={index}>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={row.minLandedPerBottle}
                          onChange={(e) =>
                            update(index, {
                              minLandedPerBottle: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="w-24 rounded border border-border-muted bg-background-primary px-2 py-1 text-right tabular-nums"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="no limit"
                          value={row.maxLandedPerBottle ?? ''}
                          onChange={(e) =>
                            update(index, {
                              maxLandedPerBottle:
                                e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                          className="w-24 rounded border border-border-muted bg-background-primary px-2 py-1 text-right tabular-nums"
                        />
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <input
                          type="number"
                          min="0"
                          max="99"
                          step="0.5"
                          value={row.b2bMarginPct}
                          onChange={(e) =>
                            update(index, { b2bMarginPct: Number(e.target.value) || 0 })
                          }
                          className="w-20 rounded border border-border-muted bg-background-primary px-2 py-1 text-right tabular-nums"
                        />
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <input
                          type="number"
                          min="0"
                          max="99"
                          step="0.5"
                          value={row.pcMarginPct}
                          onChange={(e) =>
                            update(index, { pcMarginPct: Number(e.target.value) || 0 })
                          }
                          className="w-20 rounded border border-border-muted bg-background-primary px-2 py-1 text-right tabular-nums"
                        />
                      </td>
                      <td className="py-2 pr-3 text-right text-[12px] tabular-nums text-text-muted">
                        ${row.minLandedPerBottle.toFixed(0)} →{' '}
                        <span className="font-semibold text-blue-600">
                          ${priceAt(row.minLandedPerBottle, row.b2bMarginPct).toFixed(2)}
                        </span>{' '}
                        /{' '}
                        <span className="font-semibold text-violet-600">
                          ${priceAt(row.minLandedPerBottle, row.pcMarginPct).toFixed(2)}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setRows((prev) => prev.filter((_, i) => i !== index))
                          }
                          className="rounded p-1 text-text-muted hover:bg-red-50 hover:text-red-600"
                          title="Remove this tier"
                        >
                          <IconTrash className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={() =>
                setRows((prev) => [
                  ...prev,
                  {
                    minLandedPerBottle: prev.at(-1)?.maxLandedPerBottle ?? 0,
                    maxLandedPerBottle: null,
                    b2bMarginPct: 15,
                    pcMarginPct: 25,
                  },
                ])
              }
              className="mt-3 flex items-center gap-1.5 rounded-lg border border-border-muted px-3 py-1.5 text-[13px] font-medium text-text-muted hover:bg-fill-secondary"
            >
              <IconPlus className="h-4 w-4" />
              Add tier
            </button>

            {problems.length > 0 && (
              <ul className="mt-3 space-y-0.5 text-[12px] text-red-600">
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}

            <div className="mt-5 flex items-center justify-between gap-3">
              <p className="text-[12px] text-text-muted">
                Wines below every tier fall back to the owner&apos;s flat rate.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-border-muted px-4 py-2 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={problems.length > 0 || saveMutation.isPending}
                  onClick={() =>
                    saveMutation.mutate({
                      ownerId,
                      bands: rows.map((row) => ({ ...row, ownerId })),
                    })
                  }
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  {saveMutation.isPending ? 'Saving…' : 'Save tiers'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PricingBandsEditor;
