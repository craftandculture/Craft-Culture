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
 * Collection size as bands, stored as cases on the intake (12 bottles a case)
 * so no new column is needed; each band keeps its upper bound
 */
const collectionSizes = [
  { label: 'Under 50 bottles', cases: 4 },
  { label: '50–250 bottles', cases: 21 },
  { label: '250–1,000 bottles', cases: 84 },
  { label: '1,000+ bottles', cases: 100 },
] as const;

/** The band a stored case count falls in, so an earlier answer shows selected */
const sizeOf = (approxCases: string) => {
  const cases = Number(approxCases);
  if (!approxCases || !Number.isFinite(cases)) return null;
  return collectionSizes.find((size) => cases <= size.cases)?.cases ?? 100;
};

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
      title="Your collection"
      intro="Tell us where your wine is today. Select all that apply and, when you are ready, we will take care of the rest."
      onContinue={() => onSave(answers)}
      onSkip={onSkip}
      skipLabel="Skip for now"
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

              {chosen && answer && source.value === 'lcb' && (
                <div className="space-y-2 px-4 pb-4">
                  <FieldLabel label="LCB account or cellar reference" optional>
                    <input
                      className={`${fieldClass} h-11`}
                      value={answer.holderAccountRef}
                      onChange={(event) => update(source.value, 'holderAccountRef', event.target.value)}
                    />
                  </FieldLabel>
                  <p className="text-text-muted text-xs leading-5">
                    Add it now, or we will contact you to arrange the transfer.
                  </p>
                </div>
              )}

              {chosen && answer && source.value === 'uk_eu_cellar' && (
                <div className="space-y-4 px-4 pb-4">
                  <FieldLabel label="Where is your wine held?" optional>
                    <input
                      className={`${fieldClass} h-11`}
                      value={answer.holderName}
                      onChange={(event) => update(source.value, 'holderName', event.target.value)}
                      placeholder="Merchant or warehouse name"
                    />
                  </FieldLabel>
                  <FieldLabel label="Approximate collection size" optional>
                    <div className="flex flex-wrap gap-2">
                      {collectionSizes.map((size) => {
                        const isOn = sizeOf(answer.approxCases) === size.cases;
                        return (
                          <button
                            key={size.cases}
                            type="button"
                            aria-pressed={isOn}
                            onClick={() =>
                              update(source.value, 'approxCases', isOn ? '' : String(size.cases))
                            }
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                              isOn
                                ? 'border-text-primary bg-text-primary text-surface-primary'
                                : 'border-border-primary text-text-primary'
                            }`}
                          >
                            {size.label}
                          </button>
                        );
                      })}
                    </div>
                  </FieldLabel>
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

            </div>
          );
        })}
      </div>
    </StepFrame>
  );
};

export default StepWine;
