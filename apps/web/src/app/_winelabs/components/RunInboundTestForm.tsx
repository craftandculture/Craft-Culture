'use client';

import { useActionState } from 'react';

import runInboundMatchTest from '@/app/_winelabs/actions/runInboundMatchTest';

const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '—');

/** One figure in the result */
const Figure = ({ label, value, note }: { label: string; value: string; note: string }) => (
  <div className="rounded-xl bg-fill-muted p-3">
    <div className="text-xs uppercase tracking-wide text-text-muted">{label}</div>
    <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    <div className="mt-0.5 text-xs text-text-muted">{note}</div>
  </div>
);

/**
 * Measure inbound LWIN matching on lines staff have already confirmed, and
 * show how often each matcher would have filled the line, and how often right
 */
const RunInboundTestForm = ({ disabled }: { disabled: boolean }) => {
  const [result, action, pending] = useActionState(runInboundMatchTest, null);

  return (
    <div className="space-y-3">
      <form
        action={action}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-border-muted bg-fill-primary p-3"
      >
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          Lines to test
          <input
            type="number"
            name="size"
            min={1}
            max={60}
            defaultValue={40}
            className="w-24 rounded-md border border-border-muted bg-background-primary px-2 py-1.5 text-sm text-text-primary"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          Skip the first
          <input
            type="number"
            name="skip"
            min={0}
            defaultValue={0}
            className="w-24 rounded-md border border-border-muted bg-background-primary px-2 py-1.5 text-sm text-text-primary"
          />
        </label>
        <button
          type="submit"
          disabled={disabled || pending}
          className="rounded-md bg-text-primary px-3 py-1.5 text-sm font-medium text-background-primary hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Testing…' : 'Test inbound matching'}
        </button>
        <span className="text-xs text-text-muted">
          Most recent confirmed shipment lines. Nothing is written. About 8 credits a line.
        </span>
      </form>

      {result && (
        <div className="space-y-3">
          {result.error && (
            <p className="text-sm text-red-700 dark:text-red-300">Stopped: {result.error}</p>
          )}
          <p className="text-sm text-text-muted">
            {result.tested} lines tested · {result.skippedRenamed} left out because the old matcher had renamed
            them to the register&apos;s name
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Figure
              label="Register alone (before)"
              value={pct(result.register.auto, result.tested)}
              note={`filled ${result.register.auto}, right ${result.register.right}`}
            />
            <Figure
              label="Wine Labs, first answer"
              value={pct(result.winelabs.right, result.tested)}
              note={`right on ${result.winelabs.right} of ${result.winelabs.answered} answered`}
            />
            <Figure
              label="Matcher now (automatic)"
              value={pct(result.pipeline.auto, result.tested)}
              note={`filled ${result.pipeline.auto} (${result.pipeline.byWinelabs} by Wine Labs)`}
            />
            <Figure
              label="Wrong when automatic"
              value={String(result.pipeline.wrong)}
              note={`of ${result.pipeline.auto} filled · right ${pct(result.pipeline.right, result.pipeline.auto)}`}
            />
          </div>
          {result.rows.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-border-muted">
              <table className="w-full text-sm">
                <thead className="border-b border-border-muted text-left text-xs uppercase tracking-wide text-text-muted">
                  <tr>
                    <th className="px-3 py-2">Supplier line</th>
                    <th className="px-3 py-2">Confirmed</th>
                    <th className="px-3 py-2">Wine Labs</th>
                    <th className="px-3 py-2">Matcher would write</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-muted">
                  {result.rows.map((row, index) => (
                    <tr key={`${row.shipment}-${index}`}>
                      <td className="px-3 py-2 align-top">
                        {row.line}
                        <span className="block text-xs text-text-muted">{row.shipment}</span>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span className="font-mono text-xs">{row.confirmed}</span>
                        <span className="block text-xs text-text-muted">{row.confirmedName ?? ''}</span>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span className="font-mono text-xs">{row.winelabs ?? 'No answer'}</span>
                        <span className="block text-xs text-text-muted">
                          {row.winelabsName ?? ''}
                          {row.winelabsFit !== null ? ` · fit ${row.winelabsFit}` : ''}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top">
                        {row.pipeline ? (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              row.pipeline === row.confirmed
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                                : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                            }`}
                          >
                            {row.pipeline} · {row.pipelineSource === 'winelabs' ? 'Wine Labs' : 'register'}
                          </span>
                        ) : (
                          <span className="text-xs text-text-muted">Left for a person</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RunInboundTestForm;
