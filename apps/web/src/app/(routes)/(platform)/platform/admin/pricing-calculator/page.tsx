import { IconPlus } from '@tabler/icons-react';
import Link from 'next/link';
import { Suspense } from 'react';

import SessionsList from '@/app/_pricingCalculator/components/SessionsList';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Skeleton from '@/app/_ui/components/Skeleton/Skeleton';
import Typography from '@/app/_ui/components/Typography/Typography';

/**
 * Pricing Calculator admin page
 *
 * Main entry point for the internal pricing calculator tool
 */
const PricingCalculatorPage = () => {
  return (
    <main className="container mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Typography variant="headingMd" className="mb-1">
            Pricing Calculator
          </Typography>
          <Typography variant="bodySm" colorRole="muted">
            Calculate B2B and D2C prices from supplier sheets
          </Typography>
        </div>
        <Link href="/platform/admin/pricing-calculator/new">
          <Button variant="default" colorRole="brand">
            <ButtonContent iconLeft={IconPlus}>New Session</ButtonContent>
          </Button>
        </Link>
      </div>

      {/* Sessions List */}
      <Suspense
        fallback={
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        }
      >
        <SessionsList />
      </Suspense>
    </main>
  );
};

export default PricingCalculatorPage;
