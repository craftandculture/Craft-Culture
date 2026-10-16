'use client';

import { IconCheck } from '@tabler/icons-react';

export const APPLICATION_STEPS = [
  { key: 'about', label: 'Your details' },
  { key: 'identity', label: 'Verification' },
  { key: 'wine', label: 'Your collection' },
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
      {/* On a phone four labels crowd one line, so it names only the current step */}
      <p className="text-text-primary text-xs font-semibold sm:hidden">
        Step {at + 1} of {APPLICATION_STEPS.length} · {APPLICATION_STEPS[at]?.label}
      </p>
      <ol className="hidden justify-between text-[11px] font-semibold uppercase tracking-wide sm:flex">
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
