'use client';

import { useEffect, useRef, useState } from 'react';

import hsCodeOptions from '../hsCodeOptions';

export interface HsCodeSelectProps {
  value: string;
  onSave: (code: string) => void;
  disabled?: boolean;
}

const CUSTOM = '__custom__';

/**
 * Pick an HS code from the standard list, or type a custom one
 *
 * Shows the code with its name, so "22083000 Whisky" reads at a glance.
 * A custom code must be 6 to 10 digits; anything else is refused in place.
 */
const HsCodeSelect = ({ value, onSave, disabled }: HsCodeSelectProps) => {
  const known = hsCodeOptions.find((o) => o.code === value);
  const [mode, setMode] = useState<'view' | 'pick' | 'custom'>('view');
  const [custom, setCustom] = useState(known ? '' : value);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (mode === 'custom') inputRef.current?.focus();
    if (mode === 'pick') selectRef.current?.focus();
  }, [mode]);

  const label = (
    <span className="flex min-w-0 flex-col leading-tight">
      <span className="font-mono text-[11px]">{value || '—'}</span>
      <span className="truncate text-[10px] text-text-muted">{known ? known.name : value ? 'Custom code' : 'Choose'}</span>
    </span>
  );

  if (disabled) return <div className="px-1">{label}</div>;

  if (mode === 'custom') {
    const valid = /^\d{6,10}$/.test(custom.trim());
    const commit = () => {
      if (valid && custom.trim() !== value) onSave(custom.trim());
      setMode('view');
    };
    return (
      <div className="flex flex-col gap-0.5">
        <input
          ref={inputRef}
          value={custom}
          onChange={(e) => setCustom(e.target.value.replace(/[^\d]/g, ''))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setMode('view');
          }}
          onBlur={commit}
          inputMode="numeric"
          placeholder="6–10 digits"
          className={`w-full rounded border bg-fill-primary px-1.5 py-0.5 font-mono text-[11px] ${valid || !custom ? 'border-border-brand' : 'border-border-danger'}`}
        />
        {!valid && custom && <span className="text-[10px] text-text-danger">6–10 digits</span>}
      </div>
    );
  }

  if (mode === 'pick') {
    return (
      <select
        ref={selectRef}
        value={known ? value : CUSTOM}
        onChange={(e) => {
          if (e.target.value === CUSTOM) {
            setCustom(known ? '' : value);
            setMode('custom');
            return;
          }
          if (e.target.value !== value) onSave(e.target.value);
          setMode('view');
        }}
        onBlur={() => setMode((m) => (m === 'pick' ? 'view' : m))}
        className="w-full rounded border border-border-brand bg-fill-primary px-1 py-0.5 text-[11px]"
      >
        {hsCodeOptions.map((o) => (
          <option key={o.code} value={o.code}>
            {o.code} — {o.name}
          </option>
        ))}
        <option value={CUSTOM}>{known ? 'Custom code…' : `Custom: ${value}`}</option>
      </select>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setMode('pick')}
      className="w-full rounded px-1 py-0.5 text-left hover:bg-fill-muted/60"
      title="Change HS code"
    >
      {label}
    </button>
  );
};

export default HsCodeSelect;
