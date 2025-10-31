import { Suspense } from 'react';

import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import CardHeader from '@/app/_ui/components/Card/CardHeader';
import PageContainer from '@/app/_ui/components/PageContainer/PageContainer';
import PageHeader from '@/app/_ui/components/PageHeader/PageHeader';
import Typography from '@/app/_ui/components/Typography/Typography';

import QuoteApprovalsList from './QuoteApprovalsList';

/**
 * Admin page for C&C team to review and approve quotes
 */
const QuoteApprovalsPage = () => {
  return (
    <PageContainer>
      <PageHeader
        title="Quote Approvals"
        description="Review and approve customer quotes"
      />

      <Card>
        <CardHeader>
          <Typography variant="headingSm">Pending Approvals</Typography>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </PageContainer>
  );
};

export default QuoteApprovalsPage;
