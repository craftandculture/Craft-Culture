'use client';

import { IconCalendar } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import Checkbox from '@/app/_ui/components/Checkbox/Checkbox';
import Popover from '@/app/_ui/components/Popover/Popover';
import PopoverContent from '@/app/_ui/components/Popover/PopoverContent';
import PopoverTrigger from '@/app/_ui/components/Popover/PopoverTrigger';
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
      <PopoverContent className="w-64" align="start">
        <div className="space-y-2">
          <Typography variant="labelMd" className="text-xs font-semibold">
            Alternative Vintages
          </Typography>
          <Typography
            variant="bodyXs"
            className="text-text-muted text-xs leading-relaxed"
          >
            Select vintages you&apos;d also accept for this product
          </Typography>

          {isLoading && (
            <div className="text-text-muted py-4 text-center text-xs">
              Loading vintages...
            </div>
          )}

          {!isLoading && vintages && vintages.length === 0 && (
            <div className="text-text-muted py-4 text-center text-xs">
              No alternative vintages available
            </div>
          )}

          {!isLoading && vintages && vintages.length > 0 && (
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
