'use client';

import React, { useState } from 'react';

import Input from '@/app/_ui/components/Input/Input';

interface PhoneInputProps
  extends Omit<
    React.ComponentPropsWithRef<typeof Input>,
    'onChange' | 'value'
  > {
  value?: string;
  onChange?: (value: string) => void;
  ref?: React.Ref<HTMLInputElement>;
}

const normalizePhoneNumber = (value: string): string => {
  const cleaned = value.replace(/[^\d+]/g, '');
  const digits = cleaned.replace(/\D/g, '');

  if (digits.startsWith('0')) {
    return `+31${digits.slice(1)}`;
  }

  if (!cleaned.startsWith('+') && digits.length > 0) {
    return `+${digits}`;
  }

  return cleaned;
};

const formatForDisplay = (value: string): string => {
  return value;
};

const PhoneInput = ({
  value,
  onChange,
  onBlur,
  ref,
  ...props
}: PhoneInputProps) => {
  const [displayValue, setDisplayValue] = useState(
    formatForDisplay(value || ''),
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setDisplayValue(input);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const normalized = normalizePhoneNumber(displayValue);
    const display = formatForDisplay(normalized);

    setDisplayValue(display);
    onChange?.(normalized);
    onBlur?.(e);
  };

  return (
    <Input
      {...props}
      type="tel"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder="+316123456789"
      ref={ref}
    />
  );
};

export default PhoneInput;
