import { Suspense } from 'react';

import Typography from '@/app/_ui/components/Typography/Typography';

import QuoteApprovalsList from './QuoteApprovalsList';

/**
 * Admin page for C&C team to review and approve quotes
 */
const QuoteApprovalsPage = () => {
  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6 sm:mb-8">
        <Typography variant="headingLg" className="mb-2">
          Quote Approvals
        </Typography>
        <Typography variant="bodyMd" colorRole="muted">
          Review and approve customer quote requests
        </Typography>
      </div>

      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center">
            <Typography variant="bodySm" colorRole="muted">
              Loading quotes...
            </Typography>
          </div>
        }
      >
        <QuoteApprovalsList />
      </Suspense>
    </div>
  );
};

export default QuoteApprovalsPage;
