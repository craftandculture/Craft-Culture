'use client';

import {
  IconArrowLeft,
  IconChevronDown,
  IconChevronUp,
  IconDownload,
  IconLoader2,
  IconSearch,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import PricePreviewTable from './PricePreviewTable';
import VariablesPanel from './VariablesPanel';
import type getSessionOrRedirect from '../data/getSessionOrRedirect';
import {
  type CalculationVariables,
  defaultCalculationVariables,
} from '../schemas/calculationVariablesSchema';
import exportB2BToExcel from '../utils/exportB2BToExcel';
import exportD2CToExcel from '../utils/exportD2CToExcel';

type Session = Awaited<ReturnType<typeof getSessionOrRedirect>>;

interface SessionDetailViewProps {
  session: Session;
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
  const [searchQuery, setSearchQuery] = useState('');
  const [isVariablesPanelCollapsed, setIsVariablesPanelCollapsed] = useState(false);
  const [productColWidth, setProductColWidth] = useState(200);

  // Fetch fresh session data
  const { data: session } = useQuery({
    ...api.pricingCalc.session.getOne.queryOptions({ id: initialSession.id }),
    initialData: initialSession,
  });

  const updateVariablesMutation = useMutation(api.pricingCalc.session.updateVariables.mutationOptions());
  const calculateMutation = useMutation(api.pricingCalc.session.calculate.mutationOptions());
  const updateCaseConfigMutation = useMutation(api.pricingCalc.item.updateCaseConfig.mutationOptions());

  // Auto-save default variables on first load if they don't exist
  useEffect(() => {
    if (!session.calculationVariables && !updateVariablesMutation.isPending) {
      updateVariablesMutation.mutate(
        { id: session.id, variables: defaultCalculationVariables },
        {
          onSuccess: () => {
            void queryClient.invalidateQueries({
              queryKey: api.pricingCalc.session.getOne.queryKey({ id: session.id }),
            });
          },
        },
      );
    }
  }, [session.id, session.calculationVariables]);

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

  const handleUpdateCaseConfig = (itemId: string, caseConfig: number) => {
    updateCaseConfigMutation.mutate(
      { itemId, caseConfig },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: api.pricingCalc.session.getOne.queryKey({ id: session.id }),
          });
        },
      },
    );
  };

  const handleCalculate = async () => {
    // If variables are still being saved, wait for completion
    if (updateVariablesMutation.isPending) {
      // Wait a bit for the save to complete, then recalculate
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Invalidate and refetch session to ensure we have latest variables
    await queryClient.invalidateQueries({
      queryKey: api.pricingCalc.session.getOne.queryKey({ id: session.id }),
    });

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

  const handleExportB2B = () => {
    if (!session.items || session.items.length === 0) return;

    const items = session.items.map((item) => ({
      lwin: item.lwin,
      productName: item.productName,
      vintage: item.vintage,
      region: item.region,
      producer: item.producer,
      bottleSize: item.bottleSize,
      caseConfig: item.caseConfig,
      inBondCaseUsd: item.inBondCaseUsd,
      inBondBottleUsd: item.inBondBottleUsd,
      inBondCaseAed: item.inBondCaseAed,
      inBondBottleAed: item.inBondBottleAed,
    }));

    exportB2BToExcel(items, session.name);
  };

  const handleExportD2C = () => {
    if (!session.items || session.items.length === 0) return;

    const items = session.items.map((item) => ({
      lwin: item.lwin,
      productName: item.productName,
      vintage: item.vintage,
      region: item.region,
      producer: item.producer,
      bottleSize: item.bottleSize,
      caseConfig: item.caseConfig,
      deliveredCaseUsd: item.deliveredCaseUsd,
      deliveredBottleUsd: item.deliveredBottleUsd,
      deliveredCaseAed: item.deliveredCaseAed,
      deliveredBottleAed: item.deliveredBottleAed,
    }));

    exportD2CToExcel(items, session.name);
  };

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
          <Button
            variant="outline"
            size="sm"
            disabled={!hasCalculatedItems}
            onClick={handleExportB2B}
          >
            <ButtonContent iconLeft={IconDownload}>Export B2B</ButtonContent>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasCalculatedItems}
            onClick={handleExportD2C}
          >
            <ButtonContent iconLeft={IconDownload}>Export D2C</ButtonContent>
          </Button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className={`grid gap-4 ${isVariablesPanelCollapsed ? '' : 'lg:grid-cols-4'}`}>
        {/* Preview Table - Main Content */}
        <div className={`order-2 lg:order-1 ${isVariablesPanelCollapsed ? '' : 'lg:col-span-3'}`}>
          <Card>
            <CardContent className="p-3">
              {/* Tab Headers, Search, and Width Slider */}
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-4 border-b border-border-muted">
                  <button
                    type="button"
                    className={`pb-2 text-xs font-medium transition-colors ${
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
                    className={`pb-2 text-xs font-medium transition-colors ${
                      activeTab === 'd2c'
                        ? 'border-b-2 border-fill-brand text-text-primary'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                    onClick={() => setActiveTab('d2c')}
                  >
                    D2C (Delivered)
                  </button>
                </div>
                <div className="flex items-center gap-4">
                  {/* Column Width Slider */}
                  <div className="hidden items-center gap-2 sm:flex">
                    <Typography variant="bodyXs" colorRole="muted">
                      Width
                    </Typography>
                    <input
                      type="range"
                      min={100}
                      max={400}
                      value={productColWidth}
                      onChange={(e) => setProductColWidth(parseInt(e.target.value, 10))}
                      className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-border-muted accent-fill-brand"
                    />
                  </div>
                  {/* Search */}
                  <div className="relative w-full sm:w-48">
                    <IconSearch className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                    <Input
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-7 pl-8 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Preview Table */}
              <PricePreviewTable
                items={session.items as Record<string, unknown>[]}
                rawData={rawDataRows as Record<string, unknown>[]}
                columnMapping={session.columnMapping as Record<string, string> | null}
                priceType={activeTab}
                searchQuery={searchQuery}
                productColWidth={productColWidth}
                onUpdateCaseConfig={handleUpdateCaseConfig}
                isUpdatingItem={updateCaseConfigMutation.isPending ? String(updateCaseConfigMutation.variables?.itemId ?? '') : null}
              />
            </CardContent>
          </Card>
        </div>

        {/* Variables Panel - Right Side (collapsible) */}
        <div className="order-1 lg:order-2 lg:col-span-1">
          <Card>
            <CardContent className="p-3">
              <button
                type="button"
                className="flex w-full items-center justify-between"
                onClick={() => setIsVariablesPanelCollapsed(!isVariablesPanelCollapsed)}
              >
                <Typography variant="headingXs">Pricing Variables</Typography>
                {isVariablesPanelCollapsed ? (
                  <IconChevronDown className="h-4 w-4 text-text-muted" />
                ) : (
                  <IconChevronUp className="h-4 w-4 text-text-muted" />
                )}
              </button>
              {!isVariablesPanelCollapsed && (
                <>
                  <div className="mt-3">
                    <VariablesPanel
                      variables={session.calculationVariables}
                      onChange={handleVariablesChange}
                      isUpdating={updateVariablesMutation.isPending}
                    />
                  </div>
                  <div className="mt-3 border-t border-border-muted pt-3">
                    <Button
                      variant="default"
                      colorRole="brand"
                      size="sm"
                      className="w-full"
                      onClick={handleCalculate}
                      disabled={calculateMutation.isPending || updateVariablesMutation.isPending || !session.calculationVariables}
                    >
                      <ButtonContent iconLeft={calculateMutation.isPending ? IconLoader2 : undefined}>
                        {calculateMutation.isPending ? 'Calculating...' : 'Calculate Prices'}
                      </ButtonContent>
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SessionDetailView;
