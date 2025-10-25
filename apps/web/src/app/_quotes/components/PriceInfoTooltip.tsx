import { IconInfoCircle } from '@tabler/icons-react';

import Icon from '@/app/_ui/components/Icon/Icon';
import Tooltip from '@/app/_ui/components/Tooltip/Tooltip';
import TooltipContent from '@/app/_ui/components/Tooltip/TooltipContent';
import TooltipProvider from '@/app/_ui/components/Tooltip/TooltipProvider';
import TooltipTrigger from '@/app/_ui/components/Tooltip/TooltipTrigger';
import Typography from '@/app/_ui/components/Typography/Typography';

export interface PriceInfoTooltipProps {
  customerType?: 'b2b' | 'b2c';
}

/**
 * Reusable tooltip component that displays pricing context based on customer type
 *
 * @example
 *   <PriceInfoTooltip customerType="b2b" />
 */
const PriceInfoTooltip = ({ customerType }: PriceInfoTooltipProps) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Icon icon={IconInfoCircle} size="sm" colorRole="muted" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <Typography variant="bodyXs">
            {customerType === 'b2b' ? 'In-Bond UAE' : 'Client Price'}
          </Typography>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default PriceInfoTooltip;
