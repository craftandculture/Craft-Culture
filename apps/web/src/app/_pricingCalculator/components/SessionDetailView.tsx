'use client';

import { IconArrowLeft, IconDownload, IconLoader2 } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import PricePreviewTable from './PricePreviewTable';
import VariablesPanel from './VariablesPanel';
import type { CalculationVariables } from '../schemas/calculationVariablesSchema';

interface SessionDetailViewProps {
  session: {
    id: string;
    name: string;
    status: string | null;
    sourceType: string;
    sourceFileName: string | null;
    rawData: unknown;
    detectedColumns: unknown;
    columnMapping: unknown;
    calculationVariables: CalculationVariables | null;
    itemCount: number | null;
    createdAt: Date | null;
    items: unknown[];
  };
}

/**
 * Main session detail view component
 *
 * Displays session info, variable configuration, and calculated prices
 */
const SessionDetailView = ({ session: initialSession }: SessionDetailViewProps) => {
  const router = useRouter();
  const api = useTRPC();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'b2b' | 'd2c'>('b2b');

  // Fetch fresh session data
  const { data: session } = useQuery({
    ...api.pricingCalc.session.getOne.queryOptions({ id: initialSession.id }),
    initialData: initialSession,
  });

  const updateVariablesMutation = useMutation(api.pricingCalc.session.updateVariables.mutationOptions());
  const calculateMutation = useMutation(api.pricingCalc.session.calculate.mutationOptions());

  const handleVariablesChange = (variables: CalculationVariables) => {
    updateVariablesMutation.mutate(
      { id: session.id, variables },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: api.pricingCalc.session.getOne.queryKey({ id: session.id }),
          });
        },
      },
    );
  };

  const handleCalculate = () => {
    calculateMutation.mutate(
      { id: session.id },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: api.pricingCalc.session.getOne.queryKey({ id: session.id }),
          });
        },
      },
    );
  };

  const rawDataRows = Array.isArray(session.rawData) ? session.rawData : [];
  const hasCalculatedItems = session.items && session.items.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/platform/admin/pricing-calculator')}
          >
            <ButtonContent iconLeft={IconArrowLeft}>Back</ButtonContent>
          </Button>
          <div>
            <Typography variant="headingMd">{session.name}</Typography>
            <Typography variant="bodySm" colorRole="muted">
              {session.sourceFileName} &middot; {rawDataRows.length} products
            </Typography>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={!hasCalculatedItems}>
            <ButtonContent iconLeft={IconDownload}>Export B2B</ButtonContent>
          </Button>
          <Button variant="outline" size="sm" disabled={!hasCalculatedItems}>
            <ButtonContent iconLeft={IconDownload}>Export D2C</ButtonContent>
          </Button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Variables Panel - Left Side */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-4">
              <Typography variant="headingSm" className="mb-4">
                Pricing Variables
              </Typography>
              <VariablesPanel
                variables={session.calculationVariables}
                onChange={handleVariablesChange}
                isUpdating={updateVariablesMutation.isPending}
              />
              <div className="mt-4 border-t border-border-muted pt-4">
                <Button
                  variant="default"
                  colorRole="brand"
                  className="w-full"
                  onClick={handleCalculate}
                  disabled={calculateMutation.isPending || !session.calculationVariables}
                >
                  <ButtonContent iconLeft={calculateMutation.isPending ? IconLoader2 : undefined}>
                    {calculateMutation.isPending ? 'Calculating...' : 'Calculate Prices'}
                  </ButtonContent>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview Table - Right Side */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-4">
              {/* Tab Headers */}
              <div className="mb-4 flex gap-4 border-b border-border-muted">
                <button
                  type="button"
                  className={`pb-2 text-sm font-medium transition-colors ${
                    activeTab === 'b2b'
                      ? 'border-b-2 border-fill-brand text-text-primary'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                  onClick={() => setActiveTab('b2b')}
                >
                  B2B (In-Bond UAE)
                </button>
                <button
                  type="button"
                  className={`pb-2 text-sm font-medium transition-colors ${
                    activeTab === 'd2c'
                      ? 'border-b-2 border-fill-brand text-text-primary'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                  onClick={() => setActiveTab('d2c')}
                >
                  D2C (Delivered)
                </button>
              </div>

              {/* Preview Table */}
              <PricePreviewTable
                items={session.items as Record<string, unknown>[]}
                rawData={rawDataRows as Record<string, unknown>[]}
                columnMapping={session.columnMapping as Record<string, string> | null}
                priceType={activeTab}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SessionDetailView;
