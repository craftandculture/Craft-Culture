'use client';

import { IconBox, IconPackage, IconPlane } from '@tabler/icons-react';

import Icon from '@/app/_ui/components/Icon/Icon';
import Select from '@/app/_ui/components/Select/Select';
import SelectContent from '@/app/_ui/components/Select/SelectContent';
import SelectItem from '@/app/_ui/components/Select/SelectItem';
import SelectTrigger from '@/app/_ui/components/Select/SelectTrigger';
import SelectValue from '@/app/_ui/components/Select/SelectValue';

type StockSource = 'cc_inventory' | 'partner_airfreight' | 'partner_local' | 'manual';

interface StockSourceOption {
  value: StockSource;
  label: string;
  description: string;
  icon: typeof IconBox;
  colorClass: string;
}

const stockSourceOptions: StockSourceOption[] = [
  {
    value: 'cc_inventory',
    label: 'C&C Stock',
    description: 'Available in local warehouse',
    icon: IconBox,
    colorClass: 'text-text-success',
  },
  {
    value: 'partner_airfreight',
    label: 'Airfreight',
    description: 'Sourced internationally',
    icon: IconPlane,
    colorClass: 'text-text-warning',
  },
  {
    value: 'partner_local',
    label: 'Partner Local',
    description: 'Partner local stock',
    icon: IconPackage,
    colorClass: 'text-text-brand',
  },
];

export interface StockSourceSelectProps {
  value: StockSource | undefined;
  onChange: (value: StockSource) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Select component for choosing stock source type
 *
 * Used in the approval flow to identify where each line item's
 * stock will be sourced from.
 */
const StockSourceSelect = ({ value, onChange, disabled, className }: StockSourceSelectProps) => {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as StockSource)} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Select source..." />
      </SelectTrigger>
      <SelectContent>
        {stockSourceOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <div className="flex items-center gap-2">
              <Icon icon={option.icon} size="xs" className={option.colorClass} />
              <div className="flex flex-col">
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-xs text-text-muted">{option.description}</span>
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default StockSourceSelect;
