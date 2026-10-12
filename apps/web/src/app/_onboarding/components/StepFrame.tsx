'use client';

import { IconArrowLeft, IconArrowRight } from '@tabler/icons-react';
import type { PropsWithChildren } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';

export interface StepFrameProps {
  title: string;
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
    className="bg-fill-primary border-border-muted space-y-6 rounded-2xl border p-6 shadow-sm sm:p-7"
  >
    <div className="space-y-2">
      <h1 className="font-heading text-text-primary text-2xl leading-tight">{title}</h1>
      {intro && <p className="text-text-muted text-sm leading-6">{intro}</p>}
    </div>

    <div className="space-y-5">{children}</div>

    <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        {onBack && (
          <Button type="button" variant="ghost" size="md" onClick={onBack}>
            <ButtonContent iconLeft={IconArrowLeft}>Back</ButtonContent>
          </Button>
        )}
        {onSkip && (
          <Button type="button" variant="ghost" size="md" onClick={onSkip} isDisabled={isBusy}>
            Skip for now
          </Button>
        )}
      </div>
      <Button
        type="submit"
        size="lg"
        colorRole="bold"
        isDisabled={isBusy || isContinueDisabled}
        className="sm:min-w-44"
      >
        <ButtonContent iconRight={IconArrowRight} isLoading={isBusy}>
          {continueLabel}
        </ButtonContent>
      </Button>
    </div>
  </form>
);

export default StepFrame;
