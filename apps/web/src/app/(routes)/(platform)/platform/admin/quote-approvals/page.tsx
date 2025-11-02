import { Suspense } from 'react';

import AdminPageHeader from '@/app/_admin/components/AdminPageHeader';
import Typography from '@/app/_ui/components/Typography/Typography';

import QuoteApprovalsList from './QuoteApprovalsList';

/**
 * Admin page for C&C team to review and approve quotes
 */
const QuoteApprovalsPage = () => {
  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
      <AdminPageHeader
        title="Quote Approvals"
        description="Review and approve customer quote requests"
      />

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
