'use client';

import { IconInfoCircle } from '@tabler/icons-react';
import { useState } from 'react';

import Input from '@/app/_ui/components/Input/Input';
import Switch from '@/app/_ui/components/Switch/Switch';
import Tooltip from '@/app/_ui/components/Tooltip/Tooltip';
import TooltipContent from '@/app/_ui/components/Tooltip/TooltipContent';
import TooltipProvider from '@/app/_ui/components/Tooltip/TooltipProvider';
import TooltipTrigger from '@/app/_ui/components/Tooltip/TooltipTrigger';
import Typography from '@/app/_ui/components/Typography/Typography';

export interface B2BCalculatorMarginToggleProps {
  /** Current margin type */
  marginType: 'percentage' | 'fixed';
  /** Current margin value */
  marginValue: number;
  /** Handler for margin type change */
  onMarginTypeChange: (type: 'percentage' | 'fixed') => void;
  /** Handler for margin value change */
  onMarginValueChange: (value: number) => void;
  /** Whether the field is disabled */
  disabled?: boolean;
}

/**
 * Toggle input for distributor margin (% ↔ $)
 *
 * @example
 *   <B2BCalculatorMarginToggle
 *     marginType="percentage"
 *     marginValue={15}
 *     onMarginTypeChange={setType}
 *     onMarginValueChange={setValue}
 *   />
 */
const B2BCalculatorMarginToggle = ({
  marginType,
  marginValue,
  onMarginTypeChange,
  onMarginValueChange,
  disabled = false,
}: B2BCalculatorMarginToggleProps) => {
  const [isChecked, setIsChecked] = useState(marginType === 'fixed');

  const handleToggle = (checked: boolean) => {
    setIsChecked(checked);
    onMarginTypeChange(checked ? 'fixed' : 'percentage');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);

    // Validate the value
    if (isNaN(newValue)) {
      onMarginValueChange(0);
      return;
    }

    // No negative values
    if (newValue < 0) {
      onMarginValueChange(0);
      return;
    }

    onMarginValueChange(newValue);
  };

  return (
    <div className="flex flex-col space-y-1.5">
      <div className="flex flex-col space-y-0.5">
        <div className="flex items-center gap-1.5">
          <Typography variant="bodySm">
            Distributor margin
          </Typography>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={(e) => e.preventDefault()}
                >
                  <IconInfoCircle className="h-3.5 w-3.5 text-text-muted" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <Typography variant="bodyXs">
                  Overall margin applies unless overridden per product
                </Typography>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Typography variant="bodyXs" colorRole="muted">
          Applied to In-Bond UAE Price
        </Typography>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Input
            type="number"
            value={marginValue === 0 ? '' : marginValue}
            onChange={handleChange}
            disabled={disabled}
            min={0}
            step="any"
            size="md"
            placeholder="0"
            contentRight={
              <Typography
                variant="bodySm"
                colorRole="muted"
                className="mr-2 ml-0.5"
              >
                {marginType === 'percentage' ? '%' : '$'}
              </Typography>
            }
            className="tabular-nums"
          />
        </div>

        <div className="flex items-center gap-2">
          <Typography
            variant="bodyXs"
            colorRole={marginType === 'percentage' ? 'primary' : 'muted'}
            className="text-xs"
          >
            %
          </Typography>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="inline-flex">
                  <Switch
                    checked={isChecked}
                    onCheckedChange={handleToggle}
                    disabled={disabled}
                    size="sm"
                    aria-label="Toggle between percentage and fixed margin"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <Typography variant="bodyXs">Change from % Margin to Cash Margin</Typography>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Typography
            variant="bodyXs"
            colorRole={marginType === 'fixed' ? 'primary' : 'muted'}
            className="text-xs"
          >
            $
          </Typography>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={(e) => e.preventDefault()}
                >
                  <IconInfoCircle className="h-3.5 w-3.5 text-text-muted" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <Typography variant="bodyXs">Change from % Margin to Cash Margin</Typography>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
};

export default B2BCalculatorMarginToggle;
