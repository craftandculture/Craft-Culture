'use client';

import { useEffect, useRef, useState } from 'react';

export interface EditableTextProps {
  value: string;
  onSave: (value: string) => void;
  disabled?: boolean;
  align?: 'left' | 'right' | 'center';
  placeholder?: string;
  className?: string;
}

/**
 * Text that becomes an input when clicked
 *
 * Enter or leaving the field saves; Escape abandons. Used for every editable
 * cell on the export invoice so a correction is one click, not a form.
 */
const EditableText = ({ value, onSave, disabled, align = 'left', placeholder = '—', className = '' }: EditableTextProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (editing) ref.current?.select();
  }, [editing]);

  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  if (disabled || !editing) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setEditing(true)}
        className={`w-full rounded px-1 ${alignClass} ${disabled ? 'cursor-default' : 'hover:bg-fill-muted/60'} ${value ? '' : 'text-text-muted'} ${className}`}
      >
        {value || placeholder}
      </button>
    );
  }

  const commit = () => {
    setEditing(false);
    if (draft.trim() !== value) onSave(draft.trim());
  };

  return (
    <input
      ref={ref}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') {
          setDraft(value);
          setEditing(false);
        }
      }}
      className={`w-full rounded border border-border-brand bg-fill-primary px-1 ${alignClass} ${className}`}
    />
  );
};

export default EditableText;
