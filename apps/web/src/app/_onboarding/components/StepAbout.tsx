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

/**
 * Step one: who they are — a name, and a mobile for cellar updates
 *
 * No delivery address here: it is not needed until they ask for a delivery,
 * and asking for a home address before someone has seen their cellar is
 * friction for nothing. It is collected at the first delivery.
 */
const StepAbout = ({ initial, isBusy, onSave }: StepAboutProps) => {
  const [values, setValues] = useState(initial);
  const set = (key: keyof StepAboutValues) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  return (
    <StepFrame
      title="Your details"
      intro="A few details to set up your cellar. We use your mobile to keep you updated on your wine."
      onContinue={() => onSave(values)}
      isBusy={isBusy}
      isContinueDisabled={values.fullName.trim().length < 2 || values.phone.replace(/\D/g, '').length < 7}
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
      <FieldLabel label="Mobile" hint="For cellar and delivery updates, including WhatsApp.">
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
    </StepFrame>
  );
};

export default StepAbout;
