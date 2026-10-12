'use client';

import { useState } from 'react';

import FieldLabel from './FieldLabel';
import StepFrame from './StepFrame';
import fieldClass from '../constants/fieldClass';

export interface StepAboutValues {
  fullName: string;
  phone: string;
  deliveryAddress: string;
}

export interface StepAboutProps {
  initial: StepAboutValues;
  isBusy: boolean;
  onSave: (values: StepAboutValues) => void;
}

/** Step one: who they are. Only the name is needed. */
const StepAbout = ({ initial, isBusy, onSave }: StepAboutProps) => {
  const [values, setValues] = useState(initial);
  const set = (key: keyof StepAboutValues) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  return (
    <StepFrame
      title="About you"
      intro="So we know who we're looking after. Only your name is needed now — the rest can wait."
      onContinue={() => onSave(values)}
      isBusy={isBusy}
      isContinueDisabled={values.fullName.trim().length < 2}
    >
      <FieldLabel label="Full name">
        <input
          className={`${fieldClass} h-12`}
          autoComplete="name"
          value={values.fullName}
          onChange={set('fullName')}
          placeholder="As on your Emirates ID"
        />
      </FieldLabel>
      <FieldLabel label="Mobile" hint="WhatsApp is how most members reach us." optional>
        <input
          className={`${fieldClass} h-12`}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={values.phone}
          onChange={set('phone')}
          placeholder="+971 50 000 0000"
        />
      </FieldLabel>
      <FieldLabel label="UAE delivery address" hint="Where wine is delivered when you release it." optional>
        <textarea
          className={`${fieldClass} min-h-24 py-3`}
          autoComplete="street-address"
          value={values.deliveryAddress}
          onChange={set('deliveryAddress')}
          placeholder="Villa / apartment, building, area, emirate"
        />
      </FieldLabel>
    </StepFrame>
  );
};

export default StepAbout;
