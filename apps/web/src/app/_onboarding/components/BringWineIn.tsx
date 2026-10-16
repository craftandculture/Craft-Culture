'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';

import fieldClass from '../constants/fieldClass';
import type { WineSource } from '../constants/wineSources';
import wineSources from '../constants/wineSources';
import useActivationGate from '../hooks/useActivationGate';

export interface BringWineInProps {
  onAdded: () => void;
}

const offered = wineSources.filter((source) => source.value !== 'starting_fresh');

/**
 * Ask us to bring wine in: from LCB, another cellar, or what we already hold
 *
 * Every detail is optional — we contact the holder. A transfer is an action,
 * so it opens activation first if the cellar is not active yet.
 */
const BringWineIn = ({ onAdded }: BringWineInProps) => {
  const api = useTRPC();
  const { catchActivation, activationSheet } = useActivationGate();
  const [source, setSource] = useState<WineSource | null>(null);
  const [details, setDetails] = useState({ holderName: '', approxCases: '', note: '' });

  const add = useMutation(
    api.onboarding.member.addIntake.mutationOptions({
      onSuccess: () => {
        toast.success('Thank you. We will be in touch to arrange this.');
        setSource(null);
        setDetails({ holderName: '', approxCases: '', note: '' });
        onAdded();
      },
      onError: (error) => {
        if (!catchActivation(error, 'transfer_in')) toast.error(error.message);
      },
    }),
  );

  return (
    <div className="border-border-muted bg-surface-primary rounded-xl border p-4 shadow-sm sm:p-5">
      {activationSheet}
      <p className="text-text-muted text-[11px] font-semibold uppercase tracking-wider">Bring your wine in</p>
      <p className="text-text-muted mt-1 text-xs leading-5">
        Should you wish us to bring wine in, tell us where it is held and we will take care of the rest.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {offered.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setSource(source === item.value ? null : item.value)}
            className={`h-10 rounded-lg border px-3 text-xs font-semibold transition-colors sm:h-9 sm:rounded-full ${
              source === item.value
                ? 'bg-text-primary text-surface-primary border-transparent'
                : 'border-border-muted bg-surface-primary text-text-muted hover:text-text-primary'
            }`}
          >
            {item.value === 'uae_in_bond'
              ? 'Buy in bond'
              : item.value === 'with_cc'
                ? 'Already with C&C'
                : item.value === 'lcb'
                  ? 'From LCB'
                  : 'From another cellar'}
          </button>
        ))}
      </div>

      {source && (
        <form
          className="mt-4 space-y-2 sm:max-w-lg"
          onSubmit={(event) => {
            event.preventDefault();
            add.mutate({
              source,
              holderName: details.holderName || undefined,
              approxCases: details.approxCases ? Number(details.approxCases) : undefined,
              note: details.note || undefined,
            });
          }}
        >
          {source === 'uk_eu_cellar' && (
            <input
              className={`${fieldClass} h-10 text-sm`}
              placeholder="Who holds it? e.g. Berry Bros. & Rudd"
              value={details.holderName}
              onChange={(event) => setDetails((current) => ({ ...current, holderName: event.target.value }))}
            />
          )}
          {(source === 'lcb' || source === 'uk_eu_cellar') && (
            <input
              className={`${fieldClass} h-10 text-sm`}
              inputMode="numeric"
              placeholder="Roughly how many cases? (optional)"
              value={details.approxCases}
              onChange={(event) =>
                setDetails((current) => ({ ...current, approxCases: event.target.value.replace(/\D/g, '') }))
              }
            />
          )}
          <textarea
            className={`${fieldClass} min-h-16 py-2 text-sm`}
            placeholder={source === 'uae_in_bond' ? 'What do you like to drink?' : 'Anything we should know? (optional)'}
            value={details.note}
            onChange={(event) => setDetails((current) => ({ ...current, note: event.target.value }))}
          />
          <p className="text-text-muted text-xs">If you do not have these details to hand, we will obtain them on your behalf.</p>
          <button
            type="submit"
            disabled={add.isPending}
            className="bg-text-primary text-surface-primary h-10 w-full rounded-lg text-sm font-semibold disabled:opacity-40"
          >
            {add.isPending ? 'Sending…' : 'Ask us to arrange it'}
          </button>
        </form>
      )}
    </div>
  );
};

export default BringWineIn;
