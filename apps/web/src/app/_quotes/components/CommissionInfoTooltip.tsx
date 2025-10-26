'use client';

import { IconInfoCircle } from '@tabler/icons-react';

import Icon from '@/app/_ui/components/Icon/Icon';
import Tooltip from '@/app/_ui/components/Tooltip/Tooltip';
import TooltipContent from '@/app/_ui/components/Tooltip/TooltipContent';
import TooltipProvider from '@/app/_ui/components/Tooltip/TooltipProvider';
import TooltipTrigger from '@/app/_ui/components/Tooltip/TooltipTrigger';
import Typography from '@/app/_ui/components/Typography/Typography';

/**
 * Info tooltip explaining sales commission calculation
 *
 * @example
 *   <CommissionInfoTooltip />
 */
const CommissionInfoTooltip = () => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Icon icon={IconInfoCircle} size="sm" colorRole="muted" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-0.5">
            <Typography variant="bodyXs">
              5% of supplier ex-works price
            </Typography>
            <Typography variant="bodyXs" colorRole="muted">
              Already included in your total
            </Typography>
            <Typography variant="bodyXs" colorRole="muted">
              Payable on order confirmation
            </Typography>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default CommissionInfoTooltip;
