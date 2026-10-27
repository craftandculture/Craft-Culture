'use client';

import { useActionState } from 'react';

import runCoverageBatch from '@/app/_winelabs/actions/runCoverageBatch';

export interface RunBatchFormProps {
  /** Batch size offered first: small while on free credits */
  defaultSize: number;
  disabled: boolean;
}

/**
 * Run the next batch of the Wine Labs check, and say what happened
 */
const RunBatchForm = ({ defaultSize, disabled }: RunBatchFormProps) => {
  const [result, action, pending] = useActionState(runCoverageBatch, null);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-xl border border-border-muted bg-fill-primary p-3">
      <label className="flex flex-col gap-1 text-xs text-text-muted">
        Wines to check
        <input
          type="number"
          name="size"
          min={1}
          max={25}
          defaultValue={defaultSize}
          className="w-24 rounded-md border border-border-muted bg-background-primary px-2 py-1.5 text-sm text-text-primary"
        />
      </label>
      <button
        type="submit"
        disabled={disabled || pending}
        className="rounded-md bg-text-primary px-3 py-1.5 text-sm font-medium text-background-primary hover:opacity-90 disabled:opacity-50"
      >
        {pending ? 'Checking…' : 'Check next wines'}
      </button>
      <span className="text-xs text-text-muted">Largest holdings first. Up to 26 credits a wine.</span>
      {result && (
        <p className={`w-full text-sm ${result.error ? 'text-red-700 dark:text-red-300' : 'text-text-muted'}`}>
          {result.error
            ? `Stopped after ${result.checked}: ${result.error}`
            : `Checked ${result.checked}. ${result.remaining} wines left to check.`}
        </p>
      )}
    </form>
  );
};

export default RunBatchForm;
