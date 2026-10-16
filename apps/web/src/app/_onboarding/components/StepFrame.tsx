'use client';

import { IconArrowLeft, IconArrowRight } from '@tabler/icons-react';
import type { PropsWithChildren } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';

export interface StepFrameProps {
  title: string;
  /** A small pill beside the title, e.g. "Optional for now" */
  titleNote?: string;
  intro?: string;
  onContinue: () => void;
  continueLabel?: string;
  isBusy?: boolean;
  isContinueDisabled?: boolean;
  onBack?: () => void;
  /** Offered on every optional step — nothing here may block joining */
  onSkip?: () => void;
}

/** One step's card: heading, fields, and the buttons that move on */
const StepFrame = ({
  title,
  titleNote,
  intro,
  onContinue,
  continueLabel = 'Continue',
  isBusy = false,
  isContinueDisabled = false,
  onBack,
  onSkip,
  children,
}: PropsWithChildren<StepFrameProps>) => (
  <form
    onSubmit={(event) => {
      event.preventDefault();
      onContinue();
    }}
    className="bg-fill-primary border-border-muted space-y-6 rounded-2xl border p-5 shadow-sm sm:p-7"
  >
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-heading text-text-primary text-xl leading-tight sm:text-2xl">{title}</h1>
        {titleNote && (
          <span className="bg-fill-secondary text-text-muted rounded-full px-2.5 py-0.5 text-xs font-medium">
            {titleNote}
          </span>
        )}
      </div>
      {intro && <p className="text-text-muted max-w-prose text-sm leading-6">{intro}</p>}
    </div>

    <div className="space-y-5">{children}</div>

    <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center justify-between gap-2 sm:justify-start">
        {onBack && (
          <Button type="button" variant="ghost" size="md" onClick={onBack}>
            <ButtonContent iconLeft={IconArrowLeft}>Back</ButtonContent>
          </Button>
        )}
        {onSkip && (
          <Button type="button" variant="ghost" size="md" onClick={onSkip} isDisabled={isBusy}>
            Complete later
          </Button>
        )}
      </div>
      {/* Near-black like every other primary action across the cellar */}
      <button
        type="submit"
        disabled={isBusy || isContinueDisabled}
        className="bg-text-primary text-surface-primary inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-6 text-base font-semibold transition-opacity disabled:opacity-40 sm:w-auto sm:min-w-64"
      >
        {isBusy ? 'Saving…' : continueLabel}
        {!isBusy && <IconArrowRight size={18} />}
      </button>
    </div>
  </form>
);

export default StepFrame;
