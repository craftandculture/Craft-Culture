'use client';

import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';

import TransferInstructions from './TransferInstructions';
import fieldClass from '../constants/fieldClass';
import wineHolders from '../constants/wineHolders';
import type { WineSource } from '../constants/wineSources';
import wineSources from '../constants/wineSources';
import useActivationGate from '../hooks/useActivationGate';

export interface BringWineInProps {
  /** The member's reference, quoted on wine sent to our UK bond */
  reference: string | null;
  /** Start as a single line, for a member who already has a collection */
  folded?: boolean;
  onAdded: () => void;
}

/*
  Buying is not bringing wine in, and it has its own tab in the C&C Cellar List,
  so it is offered here as a link beneath the choices rather than as one of
  them.
*/
const offered = wineSources.filter(
  (source) => source.value !== 'starting_fresh' && source.value !== 'uae_in_bond',
);

const SOURCE_LABEL: Partial<Record<WineSource, string>> = {
  lcb: 'From LCB in the UK',
  uk_eu_cellar: 'From another cellar or merchant',
  uae_bond: 'From a UAE bonded warehouse',
  investment_company: 'From an investment platform',
  multiple_locations: 'From several places',
  with_cc: 'Wine we already hold for you',
};

/**
 * Ask us to bring wine in: from LCB, another cellar, or what we already hold
 *
 * Every detail is optional — we contact the holder. A transfer is an action,
 * so it opens activation first if the cellar is not active yet.
 */
const BringWineIn = ({ reference, folded = false, onAdded }: BringWineInProps) => {
  const api = useTRPC();
  const { catchActivation, activationSheet } = useActivationGate();
  const [source, setSource] = useState<WineSource | null>(null);
  const [open, setOpen] = useState(!folded);
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

  /*
    A member with a collection already knows the way in; the choices wait
    behind one line rather than taking the screen every visit.
  */
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-border-muted bg-surface-primary flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left shadow-sm"
      >
        <span>
          <span className="text-text-primary block text-sm font-semibold">Bring more wine in</span>
          <span className="text-text-muted block text-xs">From LCB, another cellar or an investment platform</span>
        </span>
        <IconChevronDown size={18} className="text-text-muted shrink-0" />
      </button>
    );
  }

  return (
    <div className="border-border-muted bg-surface-primary rounded-xl border p-4 shadow-sm sm:p-5">
      {activationSheet}
      <div className="flex items-center justify-between gap-3">
        <p className="text-text-muted text-[11px] font-semibold uppercase tracking-wider">Bring your wine in</p>
        {folded && (
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setSource(null);
            }}
            aria-label="Collapse"
            className="text-text-muted -my-2 -mr-2 grid size-9 place-items-center rounded-full"
          >
            <IconChevronUp size={18} />
          </button>
        )}
      </div>
      <p className="text-text-primary mt-1 text-sm">Tell us where your wine is held and we will arrange the rest.</p>
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
            {SOURCE_LABEL[item.value] ?? item.label}
          </button>
        ))}
      </div>

      {!source && (
        <p className="text-text-muted mt-3 text-xs">
          Looking to add something new?{' '}
          <Link href="/platform/cellar/available" className="text-text-primary font-semibold underline underline-offset-2">
            Browse the C&C Cellar List
          </Link>
        </p>
      )}

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
          {(source === 'uk_eu_cellar' || source === 'investment_company') && (
            <>
              <input
                className={`${fieldClass} h-10 text-sm`}
                list={`bring-holders-${source}`}
                placeholder={source === 'investment_company' ? 'Which platform?' : 'Where is it held?'}
                value={details.holderName}
                onChange={(event) => setDetails((current) => ({ ...current, holderName: event.target.value }))}
              />
              <datalist id={`bring-holders-${source}`}>
                {(wineHolders[source] ?? []).map((holder) => (
                  <option key={holder} value={holder} />
                ))}
              </datalist>
            </>
          )}
          {(source === 'lcb' ||
            source === 'uk_eu_cellar' ||
            source === 'investment_company' ||
            source === 'multiple_locations') && (
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
          {/*
            Shown before they send it, so a member can pass the details on in
            the same sitting. Our own contact with the holder still follows.
          */}
          {wineSources.find((item) => item.value === source)?.isTransfer && (
            <TransferInstructions source={source} reference={reference} />
          )}
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
