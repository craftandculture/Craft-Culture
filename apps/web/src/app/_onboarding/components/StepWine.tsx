'use client';

import { IconCheck } from '@tabler/icons-react';
import { useState } from 'react';

import FieldLabel from './FieldLabel';
import StepFrame from './StepFrame';
import fieldClass from '../constants/fieldClass';
import type { WineSource } from '../constants/wineSources';
import wineSources from '../constants/wineSources';

export interface WineSourceAnswer {
  source: WineSource;
  holderName: string;
  holderAccountRef: string;
  approxCases: string;
  note: string;
  tastes: string;
}

export interface StepWineProps {
  initial: WineSourceAnswer[];
  isBusy: boolean;
  onSave: (answers: WineSourceAnswer[]) => void;
  onSkip: () => void;
  onBack: () => void;
}

const blankAnswer = (source: WineSource): WineSourceAnswer => ({
  source,
  holderName: source === 'lcb' ? 'LCB' : '',
  holderAccountRef: '',
  approxCases: '',
  note: '',
  tastes: '',
});

/**
 * Step three: where their wine is now
 *
 * Any number of sources can be ticked. The details asked for each are all
 * optional — many cellars cannot export a stock list, and we would rather
 * fetch the details ourselves than lose the member at this step.
 */
const StepWine = ({ initial, isBusy, onSave, onSkip, onBack }: StepWineProps) => {
  const [answers, setAnswers] = useState<WineSourceAnswer[]>(initial);

  const isChosen = (source: WineSource) => answers.some((answer) => answer.source === source);

  const toggle = (source: WineSource) =>
    setAnswers((current) =>
      current.some((answer) => answer.source === source)
        ? current.filter((answer) => answer.source !== source)
        : [...current, blankAnswer(source)],
    );

  const update = (source: WineSource, key: keyof Omit<WineSourceAnswer, 'source'>, value: string) =>
    setAnswers((current) =>
      current.map((answer) => (answer.source === source ? { ...answer, [key]: value } : answer)),
    );

  return (
    <StepFrame
      title="Your wine"
      intro="Where your wine is held today. Select all that apply."
      onContinue={() => onSave(answers)}
      onSkip={onSkip}
      onBack={onBack}
      isBusy={isBusy}
    >
      <div className="space-y-3">
        {wineSources.map((source) => {
          const chosen = isChosen(source.value);
          const answer = answers.find((item) => item.source === source.value);

          return (
            <div
              key={source.value}
              className={`rounded-xl border transition-colors ${
                chosen ? 'border-text-primary bg-surface-secondary/50' : 'border-border-primary'
              }`}
            >
              <button
                type="button"
                onClick={() => toggle(source.value)}
                aria-pressed={chosen}
                className="flex w-full items-start gap-3 p-4 text-left"
              >
                <span
                  className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border ${
                    chosen ? 'border-text-primary bg-text-primary text-surface-primary' : 'border-border-primary'
                  }`}
                >
                  {chosen && <IconCheck size={14} stroke={3} />}
                </span>
                <span className="space-y-0.5">
                  <span className="text-text-primary block text-sm font-semibold">{source.label}</span>
                  <span className="text-text-muted block text-xs leading-5">{source.hint}</span>
                </span>
              </button>

              {chosen && answer && source.isTransfer && (
                <div className="space-y-4 px-4 pb-4">
                  {source.value === 'uk_eu_cellar' && (
                    <FieldLabel label="Who holds it?" optional>
                      <input
                        className={`${fieldClass} h-11`}
                        value={answer.holderName}
                        onChange={(event) => update(source.value, 'holderName', event.target.value)}
                        placeholder="e.g. Berry Bros. & Rudd"
                      />
                    </FieldLabel>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <FieldLabel label="Roughly how many cases?" optional>
                      <input
                        className={`${fieldClass} h-11`}
                        inputMode="numeric"
                        value={answer.approxCases}
                        onChange={(event) =>
                          update(source.value, 'approxCases', event.target.value.replace(/\D/g, ''))
                        }
                        placeholder="e.g. 40"
                      />
                    </FieldLabel>
                    <FieldLabel label="Account number" optional>
                      <input
                        className={`${fieldClass} h-11`}
                        value={answer.holderAccountRef}
                        onChange={(event) => update(source.value, 'holderAccountRef', event.target.value)}
                      />
                    </FieldLabel>
                  </div>
                  <FieldLabel label="Anything we should know?" optional>
                    <textarea
                      className={`${fieldClass} min-h-20 py-3`}
                      value={answer.note}
                      onChange={(event) => update(source.value, 'note', event.target.value)}
                      placeholder="A contact there, part of the cellar only, timing…"
                    />
                  </FieldLabel>
                  <p className="text-text-muted text-xs leading-5">
                    If you do not have these details to hand, we will obtain them on your behalf.
                  </p>
                </div>
              )}

              {chosen && answer && (source.value === 'uae_in_bond' || source.value === 'starting_fresh') && (
                <div className="px-4 pb-4">
                  <FieldLabel label="What do you like to drink?" optional>
                    <input
                      className={`${fieldClass} h-11`}
                      value={answer.tastes}
                      onChange={(event) => update(source.value, 'tastes', event.target.value)}
                      placeholder="e.g. Burgundy, Barolo, mature Champagne"
                    />
                  </FieldLabel>
                </div>
              )}

              {chosen && answer && source.value === 'with_cc' && (
                <div className="px-4 pb-4">
                  <FieldLabel label="Whose name is it under?" optional>
                    <input
                      className={`${fieldClass} h-11`}
                      value={answer.note}
                      onChange={(event) => update(source.value, 'note', event.target.value)}
                      placeholder="If not yours — a company, or who bought it for you"
                    />
                  </FieldLabel>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </StepFrame>
  );
};

export default StepWine;
