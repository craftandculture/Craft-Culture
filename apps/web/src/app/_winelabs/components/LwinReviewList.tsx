'use client';

import { useState, useTransition } from 'react';

import reviewLwinMatch from '@/app/_winelabs/actions/reviewLwinMatch';
import type { LwinReviewRow } from '@/app/_winelabs/data/getLwinReview';

const VERDICT = {
  likely_wrong: {
    label: 'Likely wrong code',
    tone: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
  },
  check: { label: 'Check by hand', tone: 'bg-fill-muted text-text-secondary' },
  ours_right: {
    label: 'Ours looks right',
    tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
  },
  same_wine: {
    label: 'Same wine, listed twice',
    tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
  },
} as const;

/** One wine: the code we hold, the code Wine Labs suggests, and the call */
const ReviewRow = ({ row }: { row: LwinReviewRow }) => {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const verdict = VERDICT[row.verdict];

  const decide = (review: 'ours_right' | 'change' | null) =>
    startTransition(async () =>
      setError(await reviewLwinMatch(row.lwin11, review)),
    );

  return (
    <tr className={row.review ? 'opacity-60' : undefined}>
      <td className="px-3 py-2.5 align-top">
        <span className="font-medium">{row.name}</span>
        <span className="text-text-muted">
          {' '}
          {row.vintage === '1000' ? 'NV' : row.vintage}
        </span>
        <span className="text-text-muted block text-xs">
          {row.bottles} bottles
        </span>
      </td>
      <td className="px-3 py-2.5 align-top">
        <span className="font-mono text-xs">{row.ourLwin7}</span>
        <span className="text-text-muted block text-xs">
          {row.internal
            ? 'Our internal code'
            : (row.ourRegisterName ?? 'Not in the LWIN register')}
        </span>
      </td>
      <td className="px-3 py-2.5 align-top">
        <span className="font-mono text-xs">{row.suggestedLwin7 ?? '—'}</span>
        <span className="text-text-muted block text-xs">
          {row.suggestedRegisterName ?? ''}
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 align-top">
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${verdict.tone}`}
        >
          {verdict.label}
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right align-top">
        {row.review ? (
          <span className="text-text-muted text-xs">
            {row.review === 'change' ? 'To change' : 'Ours kept'}
            {row.reviewedBy ? ` · ${row.reviewedBy}` : ''}
            <button
              type="button"
              disabled={pending}
              onClick={() => decide(null)}
              className="hover:text-text-primary ml-2 underline disabled:opacity-50"
            >
              Undo
            </button>
          </span>
        ) : (
          <span className="inline-flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => decide('ours_right')}
              className="border-border-muted hover:bg-fill-muted rounded-md border px-2.5 py-1 text-xs font-medium disabled:opacity-50"
            >
              Ours is right
            </button>
            <button
              type="button"
              disabled={pending || !row.suggestedLwin7}
              onClick={() => decide('change')}
              className="bg-text-primary text-background-primary rounded-md px-2.5 py-1 text-xs font-medium hover:opacity-90 disabled:opacity-50"
            >
              Change to suggested
            </button>
          </span>
        )}
        {error && (
          <span className="block text-xs text-red-700 dark:text-red-300">
            {error}
          </span>
        )}
      </td>
    </tr>
  );
};

/** A table of wines to review */
const ReviewTable = ({ rows }: { rows: LwinReviewRow[] }) => (
  <div className="border-border-muted overflow-x-auto rounded-xl border">
    <table className="w-full text-sm">
      <thead className="border-border-muted text-text-muted border-b text-left text-xs uppercase tracking-wide">
        <tr>
          <th className="px-3 py-2">Our wine</th>
          <th className="px-3 py-2">LWIN we hold</th>
          <th className="px-3 py-2">Wine Labs suggests</th>
          <th className="px-3 py-2">Verdict</th>
          <th className="px-3 py-2" />
        </tr>
      </thead>
      <tbody className="divide-border-muted divide-y">
        {rows.map((row) => (
          <ReviewRow key={row.lwin11} row={row} />
        ))}
      </tbody>
    </table>
  </div>
);

/**
 * The LWIN fix list: codes Wine Labs disagrees with, the likely-wrong ones
 * first; those where our code already reads right, or the register lists
 * the wine twice, are folded away
 */
const LwinReviewList = ({ rows }: { rows: LwinReviewRow[] }) => {
  const settled = (row: LwinReviewRow) => row.verdict === 'ours_right' || row.verdict === 'same_wine';
  const open = rows.filter((row) => !settled(row));
  const fine = rows.filter(settled);

  return (
    <div className="space-y-3">
      {open.length ? (
        <ReviewTable rows={open} />
      ) : (
        <p className="text-text-muted text-sm">Nothing to review.</p>
      )}
      {fine.length > 0 && (
        <details className="text-sm">
          <summary className="text-text-muted cursor-pointer text-xs">
            {fine.length} where our code already reads as the right wine, or the
            register lists the wine twice
          </summary>
          <div className="mt-2">
            <ReviewTable rows={fine} />
          </div>
        </details>
      )}
    </div>
  );
};

export default LwinReviewList;
