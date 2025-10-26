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
          <div className="space-y-1">
            <Typography variant="bodyXs" className="font-semibold">
              Sales Agent Commission
            </Typography>
            <Typography variant="bodyXs">
              5% of ex-works supplier price
            </Typography>
            <Typography variant="bodyXs" colorRole="muted">
              Included in total price
            </Typography>
            <Typography variant="bodyXs" colorRole="muted">
              Paid upon order confirmation
            </Typography>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default CommissionInfoTooltip;
