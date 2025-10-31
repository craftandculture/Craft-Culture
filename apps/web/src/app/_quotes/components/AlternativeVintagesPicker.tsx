'use client';

import { IconCalendar, IconInfoCircle, IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import Checkbox from '@/app/_ui/components/Checkbox/Checkbox';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Popover from '@/app/_ui/components/Popover/Popover';
import PopoverContent from '@/app/_ui/components/Popover/PopoverContent';
import PopoverTrigger from '@/app/_ui/components/Popover/PopoverTrigger';
import Tooltip from '@/app/_ui/components/Tooltip/Tooltip';
import TooltipContent from '@/app/_ui/components/Tooltip/TooltipContent';
import TooltipProvider from '@/app/_ui/components/Tooltip/TooltipProvider';
import TooltipTrigger from '@/app/_ui/components/Tooltip/TooltipTrigger';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

export interface AlternativeVintagesPickerProps {
  productId: string;
  selectedVintages?: string[];
  onChange: (vintages: string[]) => void;
}

/**
 * Component for selecting alternative vintage years for a product
 *
 * Displays available vintages as checkboxes in a popover
 * Used in quote builder to specify client's vintage preferences
 */
const AlternativeVintagesPicker = ({
  productId,
  selectedVintages = [],
  onChange,
}: AlternativeVintagesPickerProps) => {
  const api = useTRPC();
  const [open, setOpen] = useState(false);
  const [customVintage, setCustomVintage] = useState('');

  const { data: vintages, isLoading } = useQuery({
    ...api.products.getVintagesByProduct.queryOptions({ productId }),
    enabled: open, // Only fetch when popover is opened
  });

  const handleToggle = (vintage: string) => {
    if (selectedVintages.includes(vintage)) {
      onChange(selectedVintages.filter((v) => v !== vintage));
    } else {
      onChange([...selectedVintages, vintage]);
    }
  };

  const handleAddCustomVintage = () => {
    const trimmedVintage = customVintage.trim();
    if (trimmedVintage && !selectedVintages.includes(trimmedVintage)) {
      onChange([...selectedVintages, trimmedVintage]);
      setCustomVintage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCustomVintage();
    }
  };

  const hasSelections = selectedVintages.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-text-muted hover:text-text-primary h-auto px-2 py-1"
        >
          <IconCalendar className="mr-1 h-3.5 w-3.5" />
          {hasSelections
            ? `${selectedVintages.length} alternative${selectedVintages.length === 1 ? '' : 's'}`
            : 'Add alternatives'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <Typography variant="labelMd" className="text-xs font-semibold">
                Alternative Vintages
              </Typography>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Icon
                      icon={IconInfoCircle}
                      size="sm"
                      colorRole="muted"
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div className="space-y-2">
                    <p className="font-semibold">Why add alternatives?</p>
                    <p>
                      Specify which other vintages your client would accept if
                      the preferred vintage is unavailable.
                    </p>
                    <p className="text-text-muted text-xs">
                      Example: Client requests 2020 but will also accept 2019
                      or 2021 if it&apos;s out of stock.
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Typography
            variant="bodyXs"
            className="text-text-muted text-xs leading-relaxed"
          >
            This helps ensure orders can be fulfilled even when the preferred
            vintage isn&apos;t available in inventory.
          </Typography>

          {/* Divider */}
          <div className="border-border-primary border-t" />

          {/* Custom Vintage Input */}
          <div className="space-y-2">
            <Typography variant="labelSm" className="text-xs font-medium">
              Add custom vintage
            </Typography>
            <Typography
              variant="bodyXs"
              className="text-text-muted text-xs leading-relaxed"
            >
              Enter a vintage year not listed below
            </Typography>
            <div className="flex gap-2">
              <Input
                type="text"
                size="sm"
                placeholder="e.g., 2018"
                value={customVintage}
                onChange={(e) => setCustomVintage(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleAddCustomVintage}
                isDisabled={!customVintage.trim()}
                className="shrink-0"
              >
                <IconPlus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Divider */}
          <div className="border-border-primary border-t" />

          {/* Available Vintages List */}
          {isLoading && (
            <div className="text-text-muted py-4 text-center text-xs">
              Loading available vintages...
            </div>
          )}

          {!isLoading && vintages && vintages.length === 0 && (
            <div className="bg-fill-secondary rounded-lg p-4">
              <Typography
                variant="bodyXs"
                className="text-text-muted text-center text-xs leading-relaxed"
              >
                No other vintages found in our catalog for this product. You can
                still add custom vintage years using the input above.
              </Typography>
            </div>
          )}

          {!isLoading && vintages && vintages.length > 0 && (
            <div className="space-y-2">
              <div>
                <Typography variant="labelSm" className="text-xs font-medium">
                  Select from available vintages
                </Typography>
                <Typography
                  variant="bodyXs"
                  className="text-text-muted mt-1 text-xs"
                >
                  These vintages are available in our catalog
                </Typography>
              </div>
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {vintages.map((vintage) => (
                  <label
                    key={vintage}
                    className="hover:bg-fill-secondary flex cursor-pointer items-center gap-2 rounded p-2 transition-colors"
                  >
                    <Checkbox
                      checked={selectedVintages.includes(vintage)}
                      onCheckedChange={() => handleToggle(vintage)}
                    />
                    <span className="text-sm">{vintage}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {hasSelections && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange([])}
              className="w-full"
            >
              Clear all
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default AlternativeVintagesPicker;
