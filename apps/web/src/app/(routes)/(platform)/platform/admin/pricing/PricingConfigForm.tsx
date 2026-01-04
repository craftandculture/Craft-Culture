'use client';

import { IconCheck, IconLoader2, IconRefresh } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Divider from '@/app/_ui/components/Divider/Divider';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC, { useTRPCClient } from '@/lib/trpc/browser';

type TabType = 'exchange_rates' | 'b2b' | 'pco' | 'pocket_cellar';

interface PricingVariable {
  key: string;
  label: string;
  description: string;
  suffix: string;
  step: string;
}

const EXCHANGE_RATE_VARIABLES: PricingVariable[] = [
  {
    key: 'gbp_to_usd',
    label: 'GBP → USD',
    description: 'British Pound to US Dollar exchange rate',
    suffix: '',
    step: '0.01',
  },
  {
    key: 'eur_to_usd',
    label: 'EUR → USD',
    description: 'Euro to US Dollar exchange rate',
    suffix: '',
    step: '0.01',
  },
  {
    key: 'usd_to_aed',
    label: 'USD → AED',
    description: 'US Dollar to UAE Dirham exchange rate',
    suffix: '',
    step: '0.01',
  },
];

const B2B_VARIABLES: PricingVariable[] = [
  {
    key: 'cc_margin_percent',
    label: 'C&C Margin',
    description: 'Craft & Culture margin applied to supplier price',
    suffix: '%',
    step: '0.1',
  },
];

const PCO_VARIABLES: PricingVariable[] = [
  {
    key: 'cc_margin_percent',
    label: 'C&C Margin',
    description: 'Craft & Culture margin applied to supplier price',
    suffix: '%',
    step: '0.1',
  },
  {
    key: 'import_duty_percent',
    label: 'Import Duty',
    description: 'UAE import duty applied to landed duty free',
    suffix: '%',
    step: '0.1',
  },
  {
    key: 'transfer_cost_percent',
    label: 'Transfer Cost',
    description: 'Transfer/handling fee applied to landed duty free',
    suffix: '%',
    step: '0.01',
  },
  {
    key: 'distributor_margin_percent',
    label: 'Distributor Margin',
    description: 'Distributor margin applied to duty paid landed',
    suffix: '%',
    step: '0.1',
  },
  {
    key: 'vat_percent',
    label: 'VAT',
    description: 'UAE VAT applied to final price',
    suffix: '%',
    step: '0.1',
  },
];

const POCKET_CELLAR_VARIABLES: PricingVariable[] = [
  {
    key: 'cc_margin_percent',
    label: 'C&C Margin',
    description: 'Craft & Culture margin applied to supplier price',
    suffix: '%',
    step: '0.1',
  },
  {
    key: 'logistics_air_per_bottle',
    label: 'Logistics (Air)',
    description: 'Air freight cost per bottle for international sourced products',
    suffix: 'USD',
    step: '1',
  },
  {
    key: 'logistics_ocean_per_bottle',
    label: 'Logistics (Ocean)',
    description: 'Ocean freight cost per bottle',
    suffix: 'USD',
    step: '1',
  },
  {
    key: 'import_duty_percent',
    label: 'Import Duty',
    description: 'UAE import duty applied to landed duty free',
    suffix: '%',
    step: '0.1',
  },
  {
    key: 'transfer_cost_percent',
    label: 'Transfer Cost',
    description: 'Transfer/handling fee applied to landed duty free',
    suffix: '%',
    step: '0.01',
  },
  {
    key: 'distributor_margin_percent',
    label: 'Distributor Margin',
    description: 'Distributor margin applied to duty paid landed',
    suffix: '%',
    step: '0.1',
  },
  {
    key: 'sales_commission_percent',
    label: 'Sales Commission',
    description: 'Sales advisor commission applied after distributor margin',
    suffix: '%',
    step: '0.1',
  },
  {
    key: 'vat_percent',
    label: 'VAT',
    description: 'UAE VAT applied to final price',
    suffix: '%',
    step: '0.1',
  },
];

const TAB_CONFIG = {
  exchange_rates: { label: 'Exchange Rates', variables: EXCHANGE_RATE_VARIABLES },
  b2b: { label: 'B2B Quote Tool', variables: B2B_VARIABLES },
  pco: { label: 'PCO Module', variables: PCO_VARIABLES },
  pocket_cellar: { label: 'Pocket Cellar', variables: POCKET_CELLAR_VARIABLES },
};

/**
 * Form for managing pricing configuration across modules
 *
 * Features tabbed interface for B2B, PCO, and Pocket Cellar pricing.
 */
const PricingConfigForm = () => {
  const api = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabType>('exchange_rates');
  const [formValues, setFormValues] = useState<Record<string, Record<string, number>>>({
    exchange_rates: {},
    b2b: {},
    pco: {},
    pocket_cellar: {},
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [isFetchingRates, setIsFetchingRates] = useState(false);

  // Fetch current pricing config
  const { data: pricingConfig, isLoading } = useQuery(api.pricing.getConfig.queryOptions({}));

  // Initialize form values when data loads
  useEffect(() => {
    if (pricingConfig) {
      const newValues: Record<string, Record<string, number>> = {
        exchange_rates: {},
        b2b: {},
        pco: {},
        pocket_cellar: {},
      };

      // Map Exchange Rates
      if (pricingConfig.exchangeRates) {
        newValues.exchange_rates = {
          gbp_to_usd: pricingConfig.exchangeRates.gbpToUsd,
          eur_to_usd: pricingConfig.exchangeRates.eurToUsd,
          usd_to_aed: pricingConfig.exchangeRates.usdToAed,
        };
      }

      // Map B2B
      if (pricingConfig.b2b) {
        newValues.b2b = {
          cc_margin_percent: pricingConfig.b2b.ccMarginPercent,
        };
      }

      // Map PCO
      if (pricingConfig.pco) {
        newValues.pco = {
          cc_margin_percent: pricingConfig.pco.ccMarginPercent,
          import_duty_percent: pricingConfig.pco.importDutyPercent,
          transfer_cost_percent: pricingConfig.pco.transferCostPercent,
          distributor_margin_percent: pricingConfig.pco.distributorMarginPercent,
          vat_percent: pricingConfig.pco.vatPercent,
        };
      }

      // Map Pocket Cellar
      if (pricingConfig.pocketCellar) {
        newValues.pocket_cellar = {
          cc_margin_percent: pricingConfig.pocketCellar.ccMarginPercent,
          import_duty_percent: pricingConfig.pocketCellar.importDutyPercent,
          transfer_cost_percent: pricingConfig.pocketCellar.transferCostPercent,
          distributor_margin_percent: pricingConfig.pocketCellar.distributorMarginPercent,
          vat_percent: pricingConfig.pocketCellar.vatPercent,
          logistics_air_per_bottle: pricingConfig.pocketCellar.logisticsAirPerBottle,
          logistics_ocean_per_bottle: pricingConfig.pocketCellar.logisticsOceanPerBottle,
          sales_commission_percent: pricingConfig.pocketCellar.salesCommissionPercent,
        };
      }

      setFormValues(newValues);
    }
  }, [pricingConfig]);

  // Update mutation
  const { mutateAsync: updateConfig, isPending: isUpdating } = useMutation({
    mutationFn: async (params: { module: TabType; key: string; value: number }) => {
      return trpcClient.pricing.updateConfig.mutate(params);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pricing'] });
    },
  });

  const handleValueChange = (module: TabType, key: string, value: number) => {
    setFormValues((prev) => ({
      ...prev,
      [module]: {
        ...prev[module],
        [key]: value,
      },
    }));
    setHasChanges(true);
  };

  // Fetch latest exchange rates from ECB
  const handleFetchLatestRates = async () => {
    setIsFetchingRates(true);
    try {
      const result = await trpcClient.pricing.fetchLatestExchangeRates.mutate();
      setFormValues((prev) => ({
        ...prev,
        exchange_rates: {
          gbp_to_usd: result.gbpToUsd,
          eur_to_usd: result.eurToUsd,
          usd_to_aed: result.usdToAed,
        },
      }));
      setHasChanges(true);
      toast.success('Exchange rates fetched from ECB');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to fetch exchange rates');
    } finally {
      setIsFetchingRates(false);
    }
  };

  const handleSave = async () => {
    try {
      const updates: Promise<unknown>[] = [];

      // Save all changed values for current tab
      const currentTab = activeTab;
      const variables = TAB_CONFIG[currentTab].variables;
      const currentValues = formValues[currentTab] ?? {};

      for (const variable of variables) {
        const value = currentValues[variable.key];
        if (value !== undefined) {
          updates.push(
            updateConfig({
              module: currentTab,
              key: variable.key,
              value,
            }),
          );
        }
      }

      await Promise.all(updates);
      setHasChanges(false);
      toast.success('Pricing configuration saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save pricing configuration');
    }
  };

  if (isLoading) {
    return <div className="h-96 animate-pulse rounded-lg bg-surface-muted" />;
  }

  const currentVariables = TAB_CONFIG[activeTab].variables;
  const currentValues = formValues[activeTab] ?? {};

  return (
    <div className="space-y-6">
      <Divider />

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-border-muted">
        {(Object.keys(TAB_CONFIG) as TabType[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'border-fill-brand text-fill-brand'
                : 'border-transparent text-text-muted hover:border-border-muted hover:text-text-primary'
            }`}
          >
            {TAB_CONFIG[tab].label}
          </button>
        ))}
      </div>

      {/* Formula Preview / Info Section */}
      <div className="rounded-lg border border-border-muted bg-surface-secondary/50 p-4">
        <Typography variant="bodyXs" colorRole="muted" className="mb-2 font-medium uppercase tracking-wide">
          {activeTab === 'exchange_rates' ? 'Exchange Rate Info' : 'Calculation Method'}
        </Typography>
        {activeTab === 'exchange_rates' && (
          <div className="space-y-3">
            <Typography variant="bodySm">
              Exchange rates are used for currency conversion in pricing calculations. USD is the base currency for all pricing.
            </Typography>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleFetchLatestRates}
                isDisabled={isFetchingRates}
              >
                <ButtonContent>
                  <Icon icon={isFetchingRates ? IconLoader2 : IconRefresh} size="sm" className={isFetchingRates ? 'animate-spin' : ''} />
                  <span className="ml-2">{isFetchingRates ? 'Fetching...' : 'Fetch Latest from ECB'}</span>
                </ButtonContent>
              </Button>
              <Typography variant="bodyXs" colorRole="muted">
                Fetches current rates from European Central Bank
              </Typography>
            </div>
          </div>
        )}
        {activeTab === 'b2b' && (
          <Typography variant="bodySm" className="font-mono">
            Final B2B Price = Supplier Price ÷ (1 - {currentValues.cc_margin_percent ?? 5}%)
          </Typography>
        )}
        {activeTab === 'pco' && (
          <div className="space-y-1 font-mono text-sm">
            <Typography variant="bodySm">
              1. Landed Duty Free = Supplier Price ÷ (1 - {currentValues.cc_margin_percent ?? 2.5}%)
            </Typography>
            <Typography variant="bodySm">
              2. Import Duty = LDF × {currentValues.import_duty_percent ?? 20}%
            </Typography>
            <Typography variant="bodySm">
              3. Transfer = LDF × {currentValues.transfer_cost_percent ?? 0.75}%
            </Typography>
            <Typography variant="bodySm">
              4. Duty Paid = LDF + Duty + Transfer
            </Typography>
            <Typography variant="bodySm">
              5. After Distributor = Duty Paid ÷ (1 - {currentValues.distributor_margin_percent ?? 7.5}%)
            </Typography>
            <Typography variant="bodySm">
              6. Final = After Distributor + ({currentValues.vat_percent ?? 5}% VAT)
            </Typography>
          </div>
        )}
        {activeTab === 'pocket_cellar' && (
          <div className="space-y-1 font-mono text-sm">
            <Typography variant="bodySm">
              1. After C&C = Supplier Price ÷ (1 - {currentValues.cc_margin_percent ?? 5}%)
            </Typography>
            <Typography variant="bodySm">
              2. LDF = After C&C + Logistics (${currentValues.logistics_air_per_bottle ?? 20} air / ${currentValues.logistics_ocean_per_bottle ?? 5} ocean)
            </Typography>
            <Typography variant="bodySm">
              3. Import Duty = LDF × {currentValues.import_duty_percent ?? 20}%
            </Typography>
            <Typography variant="bodySm">
              4. Transfer = LDF × {currentValues.transfer_cost_percent ?? 0.75}%
            </Typography>
            <Typography variant="bodySm">
              5. Duty Paid = LDF + Duty + Transfer
            </Typography>
            <Typography variant="bodySm">
              6. After Distributor = Duty Paid ÷ (1 - {currentValues.distributor_margin_percent ?? 7.5}%)
            </Typography>
            <Typography variant="bodySm">
              7. Pre-VAT = After Distributor × (1 + {currentValues.sales_commission_percent ?? 2}%)
            </Typography>
            <Typography variant="bodySm">
              8. Final = Pre-VAT + ({currentValues.vat_percent ?? 5}% VAT)
            </Typography>
          </div>
        )}
      </div>

      {/* Variables Form */}
      <div className="space-y-4">
        <Typography variant="bodySm" className="font-semibold">
          Pricing Variables
        </Typography>

        <div className="grid gap-4 sm:grid-cols-2">
          {currentVariables.map((variable) => (
            <div key={variable.key} className="space-y-1">
              <label htmlFor={variable.key}>
                <Typography variant="bodyXs" className="font-medium">
                  {variable.label}
                </Typography>
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id={variable.key}
                  type="number"
                  step={variable.step}
                  value={currentValues[variable.key] ?? ''}
                  onChange={(e) =>
                    handleValueChange(activeTab, variable.key, parseFloat(e.target.value))
                  }
                  className="flex-1"
                />
                <span className="w-12 text-sm text-text-muted">{variable.suffix}</span>
              </div>
              <Typography variant="bodyXs" colorRole="muted">
                {variable.description}
              </Typography>
            </div>
          ))}
        </div>
      </div>

      <Divider />

      {/* Save Button */}
      <div className="flex items-center justify-between">
        <Typography variant="bodyXs" colorRole="muted">
          {hasChanges ? 'You have unsaved changes' : 'All changes saved'}
        </Typography>
        <Button
          variant="default"
          colorRole="brand"
          onClick={handleSave}
          isDisabled={isUpdating || !hasChanges}
        >
          <ButtonContent>
            {isUpdating ? (
              <>
                <Icon icon={IconLoader2} size="sm" className="animate-spin" />
                <span className="ml-2">Saving...</span>
              </>
            ) : (
              <>
                <Icon icon={IconCheck} size="sm" />
                <span className="ml-2">Save Changes</span>
              </>
            )}
          </ButtonContent>
        </Button>
      </div>
    </div>
  );
};

export default PricingConfigForm;
