import type { PropsWithChildren } from 'react';

export interface FieldLabelProps {
  label: string;
  hint?: string;
  optional?: boolean;
}

/** A labelled field, with an "optional" marker where it applies */
const FieldLabel = ({ label, hint, optional, children }: PropsWithChildren<FieldLabelProps>) => (
  <label className="block space-y-2">
    <span className="flex items-baseline justify-between gap-2">
      <span className="text-text-primary text-sm font-semibold">{label}</span>
      {optional && <span className="text-text-muted text-xs">Optional</span>}
    </span>
    {children}
    {hint && <span className="text-text-muted block text-xs leading-5">{hint}</span>}
  </label>
);

export default FieldLabel;
