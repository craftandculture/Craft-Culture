'use client';

import { IconCheck } from '@tabler/icons-react';

export const APPLICATION_STEPS = [
  { key: 'about', label: 'About you' },
  { key: 'identity', label: 'Identity' },
  { key: 'wine', label: 'Your wine' },
  { key: 'membership', label: 'Membership' },
] as const;

export type ApplicationStepKey = (typeof APPLICATION_STEPS)[number]['key'];

export interface ApplicationProgressProps {
  current: ApplicationStepKey;
  onJump?: (step: ApplicationStepKey) => void;
}

/** Where they are in the four steps; earlier steps can be revisited */
const ApplicationProgress = ({ current, onJump }: ApplicationProgressProps) => {
  const at = APPLICATION_STEPS.findIndex((step) => step.key === current);

  return (
    <nav aria-label="Application progress" className="space-y-3">
      <div className="flex gap-1.5">
        {APPLICATION_STEPS.map((step, index) => (
          <span
            key={step.key}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${
              index <= at ? 'bg-text-primary' : 'bg-border-muted'
            }`}
          />
        ))}
      </div>
      <ol className="flex justify-between text-[11px] font-semibold uppercase tracking-wide">
        {APPLICATION_STEPS.map((step, index) => (
          <li key={step.key}>
            <button
              type="button"
              disabled={index > at || !onJump}
              onClick={() => onJump?.(step.key)}
              className={`flex items-center gap-1 ${
                index === at
                  ? 'text-text-primary'
                  : index < at
                    ? 'text-text-primary underline-offset-2 hover:underline'
                    : 'text-text-muted'
              }`}
            >
              {index < at && <IconCheck size={12} stroke={3} />}
              {step.label}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default ApplicationProgress;
