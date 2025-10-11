import { IconCheck, IconPencil } from '@tabler/icons-react';
import { useRef, useState } from 'react';

import Button from '../Button/Button';
import ButtonContent from '../Button/ButtonContent';
import Icon from '../Icon/Icon';
import Input from '../Input/Input';
import Typography, { TypographyProps } from '../Typography/Typography';

export interface EditableTitleProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value: string;
  variant?: TypographyProps['variant'];
  onChange?: (value: string) => void | Promise<void>;
  onSave?: (value: string) => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
}

const EditableTitle = ({
  value,
  onSave,
  onCancel,
  onBlur,
  variant = 'labelSm',
}: EditableTitleProps) => {
  const ref = useRef<HTMLInputElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  const [inputValue, setInputValue] = useState(value);
  const [isEditing, setIsEditing] = useState(false);

  const handleCancel = async () => {
    await onCancel?.();
    setIsEditing(false);
  };

  const handleSave = async () => {
    await onSave?.(inputValue);
    ref?.current?.blur();
    setIsEditing(false);
  };

  return (
    <div className="flex items-center gap-1.5">
      {isEditing ? (
        <Input
          asChild
          className="-ml-2.5 min-w-40 max-w-full gap-0 pr-px"
          size="md"
          autoFocus
          value={inputValue}
          minLength={3}
          maxLength={50}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={(e) => {
            if (!saveButtonRef.current?.contains(e.relatedTarget as Node)) {
              void handleCancel();
            }
            onBlur?.(e);
          }}
          contentRight={
            <Button
              asChild
              variant="ghost"
              size="sm"
              shape="circle"
              onClick={handleSave}
            >
              <button ref={saveButtonRef}>
                <ButtonContent>
                  <Icon icon={IconCheck} colorRole="muted" />
                </ButtonContent>
              </button>
            </Button>
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              void handleSave();
            }
            if (e.key === 'Escape') {
              void handleCancel();
            }
          }}
        >
          <input ref={ref} size={value.length} className="w-full" />
        </Input>
      ) : (
        <Typography
          variant={variant}
          asChild
          onDoubleClick={() => setIsEditing(true)}
          className="line-clamp-1"
        >
          <h2>{value}</h2>
        </Typography>
      )}

      {!isEditing && (
        <Button
          variant="ghost"
          size="sm"
          shape="circle"
          onClick={() => setIsEditing(true)}
        >
          <ButtonContent>
            <Icon icon={IconPencil} colorRole="muted" />
          </ButtonContent>
        </Button>
      )}
    </div>
  );
};

export default EditableTitle;
