'use client';

import { useActionState } from 'react';

import runInBondBatch from '@/app/_winelabs/actions/runInBondBatch';

export interface RunInBondFormProps {
  defaultSize: number;
  disabled: boolean;
}

/**
 * Fetch London in-bond prices for the next batch of wines, and say what happened
 */
const RunInBondForm = ({ defaultSize, disabled }: RunInBondFormProps) => {
  const [result, action, pending] = useActionState(runInBondBatch, null);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-xl border border-border-muted bg-fill-primary p-3">
      <label className="flex flex-col gap-1 text-xs text-text-muted">
        Wines to price
        <input
          type="number"
          name="size"
          min={1}
          max={50}
          defaultValue={defaultSize}
          className="w-24 rounded-md border border-border-muted bg-background-primary px-2 py-1.5 text-sm text-text-primary"
        />
      </label>
      <button
        type="submit"
        disabled={disabled || pending}
        className="rounded-md bg-text-primary px-3 py-1.5 text-sm font-medium text-background-primary hover:opacity-90 disabled:opacity-50"
      >
        {pending ? 'Pricing…' : 'Price next wines'}
      </button>
      <span className="text-xs text-text-muted">
        Largest holdings first. Listed wines are asked again after 30 days, unlisted after 90. 15 credits a
        wine, 30 when its trades are also due (quarterly).
      </span>
      {result && (
        <p className={`w-full text-sm ${result.error ? 'text-red-700 dark:text-red-300' : 'text-text-muted'}`}>
          {result.error
            ? `Stopped after ${result.priced + result.unlisted}: ${result.error}`
            : `Priced ${result.priced}, not listed in London ${result.unlisted}. ${result.remaining} wines left.`}
        </p>
      )}
    </form>
  );
};

export default RunInBondForm;
