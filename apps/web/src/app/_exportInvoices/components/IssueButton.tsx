'use client';

import Button from '@/app/_ui/components/Button/Button';
import Tooltip from '@/app/_ui/components/Tooltip/Tooltip';
import TooltipContent from '@/app/_ui/components/Tooltip/TooltipContent';
import TooltipProvider from '@/app/_ui/components/Tooltip/TooltipProvider';
import TooltipTrigger from '@/app/_ui/components/Tooltip/TooltipTrigger';

export interface IssueButtonProps {
  label: string;
  /** Why it cannot be issued yet, or null when it can */
  blockedBy: string | null;
  revising: boolean;
  number: string | null;
  pending: boolean;
  onIssue: () => void;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * The Issue button, with a tooltip saying what issuing does
 *
 * Issuing is the one step that cannot be undone quietly, so the tooltip says
 * what happens — numbered, PDF saved, frozen — and, when the button is
 * disabled, exactly what is stopping it. The trigger is a wrapper because a
 * disabled button never receives the hover that opens a tooltip.
 */
const IssueButton = ({ label, blockedBy, revising, number, pending, onIssue, size = 'md', className = '' }: IssueButtonProps) => {
  const explanation = revising
    ? `Re-issues ${number} under the same number: saves a new PDF version and freezes the document again. Earlier PDFs stay in History.`
    : 'Gives the document the next EXP number, saves the PDF and freezes it. You can still Edit it later under the same number, or cancel it.';

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className={`inline-flex ${className}`}>
            <Button
              size={size}
              colorRole="brand"
              className="w-full justify-center"
              disabled={Boolean(blockedBy) || pending}
              onClick={onIssue}
            >
              {pending ? 'Issuing…' : label}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="max-w-xs text-left text-xs">
          {blockedBy ? (
            <>
              <span className="block font-semibold text-text-warning">Not ready yet</span>
              {blockedBy}
            </>
          ) : (
            explanation
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default IssueButton;
