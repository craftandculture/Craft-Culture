'use client';

import { IconCheck, IconX } from '@tabler/icons-react';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';

export interface EditableFieldProps {
  /** The stored value; a date for `type="date"`, otherwise text */
  value: string | Date | null | undefined;
  type?: 'text' | 'date';
  placeholder?: string;
  mono?: boolean;
  disabled?: boolean;
  /**
   * Called with the new value when it differs from the stored one. Text is
   * trimmed and may be empty (clearing the field); a date is null when cleared.
   */
  onSave: (next: string | Date | null) => void;
}

/**
 * A date as the yyyy-mm-dd a date input expects, in the viewer's own calendar
 *
 * toISOString() would give the UTC day, which is the day before for anyone
 * west of Greenwich looking at a midnight timestamp.
 *
 * @param value - The stored date
 * @returns The date input value, or an empty string
 */
const toDateInput = (value: string | Date | null | undefined) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/**
 * How a stored value reads when not being edited
 *
 * @param value - The stored value
 * @param type - Text or date
 * @returns The display string, or a dash when empty
 */
const toDisplay = (value: string | Date | null | undefined, type: 'text' | 'date') => {
  if (!value) return '-';
  if (type === 'text') return String(value);

  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * A shipment field that reads as text and edits in place on click
 *
 * Enter or the tick saves, Escape or the cross cancels. Nothing is sent when
 * the value is unchanged.
 *
 * @example
 *   <EditableField value={shipment.carrierName} onSave={(v) => update({ carrierName: v as string })} />
 */
const EditableField = ({
  value,
  type = 'text',
  placeholder,
  mono = false,
  disabled = false,
  onSave,
}: EditableFieldProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const initial = type === 'date' ? toDateInput(value) : String(value ?? '');

  const cancel = () => {
    setIsEditing(false);
    setDraft(initial);
  };

  const save = () => {
    const trimmed = draft.trim();
    setIsEditing(false);
    if (trimmed === initial) return;

    if (type === 'date') {
      // Noon local time keeps the day the same whatever the viewer's timezone
      onSave(trimmed ? new Date(`${trimmed}T12:00:00`) : null);
      return;
    }

    onSave(trimmed);
  };

  if (!isEditing) {
    return (
      <button
        type="button"
        disabled={disabled}
        className={`cursor-pointer text-right hover:underline disabled:cursor-default disabled:no-underline ${mono ? 'font-mono' : ''}`}
        onClick={() => {
          setDraft(initial);
          setIsEditing(true);
        }}
      >
        {toDisplay(value, type)}
      </button>
    );
  }

  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Input
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className={`h-7 w-40 text-sm ${mono ? 'font-mono' : ''}`}
        placeholder={placeholder}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Escape') cancel();
        }}
      />
      <Button type="submit" variant="ghost" size="sm" aria-label="Save">
        <Icon icon={IconCheck} size="sm" />
      </Button>
      <Button type="button" variant="ghost" size="sm" aria-label="Cancel" onClick={cancel}>
        <Icon icon={IconX} size="sm" />
      </Button>
    </form>
  );
};

export default EditableField;
