import { Suspense } from 'react';

import Typography from '@/app/_ui/components/Typography/Typography';

import QuoteApprovalsList from './QuoteApprovalsList';

/**
 * Admin page for C&C team to review and approve quotes
 */
const QuoteApprovalsPage = () => {
  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <Typography variant="headingLg" className="mb-2">
          Quote Approvals
        </Typography>
        <Typography variant="bodyMd" colorRole="muted">
          Review and approve customer quotes
        </Typography>
      </div>

      <div className="rounded-lg border border-border-primary bg-fill-primary p-6">
        <Typography variant="headingSm" className="mb-6">
          Pending Approvals
        </Typography>
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
    </div>
  );
};

export default QuoteApprovalsPage;
