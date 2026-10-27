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

import PartnerBespokePricingTable from './PartnerBespokePricingTable';

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
    step: 'any',
  },
  {
    key: 'eur_to_usd',
    label: 'EUR → USD',
    description: 'Euro to US Dollar exchange rate',
    suffix: '',
    step: 'any',
  },
  {
    key: 'usd_to_aed',
    label: 'USD → AED',
    description: 'US Dollar to UAE Dirham exchange rate',
    suffix: '',
    step: 'any',
  },
];

const B2B_VARIABLES: PricingVariable[] = [
  {
    key: 'cc_margin_percent',
    label: 'C&C Margin',
    description: 'Craft & Culture margin applied to supplier price',
    suffix: '%',
    step: 'any',
  },
];

const PCO_VARIABLES: PricingVariable[] = [
  {
    key: 'cc_margin_percent',
    label: 'C&C Margin',
    description: 'Craft & Culture margin applied to supplier price',
    suffix: '%',
    step: 'any',
  },
  {
    key: 'import_duty_percent',
    label: 'Import Duty',
    description: 'UAE import duty applied to landed duty free',
    suffix: '%',
    step: 'any',
  },
  {
    key: 'transfer_cost_percent',
    label: 'Transfer Cost',
    description: 'Transfer/handling fee applied to landed duty free',
    suffix: '%',
    step: 'any',
  },
  {
    key: 'distributor_margin_percent',
    label: 'Distributor Margin',
    description: 'Distributor margin applied to duty paid landed',
    suffix: '%',
    step: 'any',
  },
  {
    key: 'vat_percent',
    label: 'VAT',
    description: 'UAE VAT applied to final price',
    suffix: '%',
    step: 'any',
  },
];

const POCKET_CELLAR_VARIABLES: PricingVariable[] = [
  {
    key: 'cc_margin_percent',
    label: 'C&C Margin',
    description: 'Craft & Culture margin applied to supplier price',
    suffix: '%',
    step: 'any',
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
    step: 'any',
  },
  {
    key: 'transfer_cost_percent',
    label: 'Transfer Cost',
    description: 'Transfer/handling fee applied to landed duty free',
    suffix: '%',
    step: 'any',
  },
  {
    key: 'distributor_margin_percent',
    label: 'Distributor Margin',
    description: 'Distributor margin applied to duty paid landed',
    suffix: '%',
    step: 'any',
  },
  {
    key: 'sales_commission_percent',
    label: 'Sales Commission',
    description: 'Sales advisor commission applied after distributor margin',
    suffix: '%',
    step: 'any',
  },
  {
    key: 'vat_percent',
    label: 'VAT',
    description: 'UAE VAT applied to final price',
    suffix: '%',
    step: 'any',
  },
];

const TAB_CONFIG = {
  exchange_rates: { label: 'Exchange Rates', variables: EXCHANGE_RATE_VARIABLES },
  b2b: { label: 'B2B Quote Tool', variables: B2B_VARIABLES },
  pco: { label: 'PCO Module', variables: PCO_VARIABLES },
  pocket_cellar: { label: 'Craft & Culture', variables: POCKET_CELLAR_VARIABLES },
};

/**
 * Form for managing pricing configuration across modules
 *
 * Features tabbed interface for B2B, PCO, and Craft & Culture pricing.
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
  // Keys edited since the last save, per tab, so Save writes every tab the
  // user touched (it used to save only the tab on screen)
  const [dirty, setDirty] = useState<Record<TabType, string[]>>({
    exchange_rates: [],
    b2b: [],
    pco: [],
    pocket_cellar: [],
  });
  const hasChanges = Object.values(dirty).some((keys) => keys.length > 0);
  const markDirty = (module: TabType, keys: string[]) =>
    setDirty((prev) => ({
      ...prev,
      [module]: [...new Set([...prev[module], ...keys])],
    }));
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
  });

  const handleValueChange = (module: TabType, key: string, value: number) => {
    setFormValues((prev) => ({
      ...prev,
      [module]: {
        ...prev[module],
        [key]: value,
      },
    }));
    markDirty(module, [key]);
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
      markDirty('exchange_rates', ['gbp_to_usd', 'eur_to_usd', 'usd_to_aed']);
      toast.success('Exchange rates fetched from ECB');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to fetch exchange rates');
    } finally {
      setIsFetchingRates(false);
    }
  };

  const handleSave = async () => {
    const changes = (Object.keys(dirty) as TabType[]).flatMap((module) =>
      dirty[module].map((key) => ({ module, key, value: formValues[module]?.[key] })),
    );

    const invalid = changes.filter(
      (change) => change.value === undefined || !Number.isFinite(change.value),
    );

    if (invalid.length > 0) {
      const labels = invalid.map(
        (change) =>
          `${TAB_CONFIG[change.module].label}: ${
            TAB_CONFIG[change.module].variables.find((v) => v.key === change.key)?.label ??
            change.key
          }`,
      );
      toast.error(`Enter a number for ${labels.join(', ')}`);
      return;
    }

    const results = await Promise.allSettled(
      changes.map((change) =>
        updateConfig({ module: change.module, key: change.key, value: change.value! }),
      ),
    );

    // Keep anything that failed marked as unsaved
    const failed = changes.filter((_, index) => results[index]?.status === 'rejected');
    setDirty({
      exchange_rates: failed.filter((c) => c.module === 'exchange_rates').map((c) => c.key),
      b2b: failed.filter((c) => c.module === 'b2b').map((c) => c.key),
      pco: failed.filter((c) => c.module === 'pco').map((c) => c.key),
      pocket_cellar: failed.filter((c) => c.module === 'pocket_cellar').map((c) => c.key),
    });

    void queryClient.invalidateQueries({ queryKey: api.pricing.getConfig.queryKey() });
    void queryClient.invalidateQueries({ queryKey: api.pricing.getSharedDefaults.queryKey() });

    if (failed.length > 0) {
      const firstError = results.find((r) => r.status === 'rejected') as
        | PromiseRejectedResult
        | undefined;
      toast.error(
        `${failed.length} of ${changes.length} changes were not saved: ${
          firstError?.reason instanceof Error ? firstError.reason.message : 'unknown error'
        }`,
      );
      return;
    }

    toast.success('Pricing configuration saved');
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
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-1 border-b border-border-muted sm:gap-2">
          {(Object.keys(TAB_CONFIG) as TabType[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
                activeTab === tab
                  ? 'border-fill-brand text-fill-brand'
                  : 'border-transparent text-text-muted hover:border-border-muted hover:text-text-primary'
              }`}
            >
              {TAB_CONFIG[tab].label}
            </button>
          ))}
        </div>
      </div>

      {/* Formula Preview / Info Section */}
      <div className="rounded-lg border border-border-muted bg-surface-secondary/50 p-3 sm:p-4">
        <Typography variant="bodyXs" colorRole="muted" className="mb-2 font-medium uppercase tracking-wide">
          {activeTab === 'exchange_rates' ? 'Exchange Rate Info' : 'Calculation Method'}
        </Typography>
        {activeTab === 'exchange_rates' && (
          <div className="space-y-3">
            <Typography variant="bodySm">
              Exchange rates are used for currency conversion in pricing calculations. USD is the base currency for all pricing.
            </Typography>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleFetchLatestRates}
                isDisabled={isFetchingRates}
                className="w-full sm:w-auto"
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
          <div className="overflow-x-auto">
            <Typography variant="bodySm" className="whitespace-nowrap font-mono text-xs sm:text-sm">
              Final B2B Price = Supplier Price ÷ (1 - {currentValues.cc_margin_percent ?? 5}%)
            </Typography>
          </div>
        )}
        {activeTab === 'pco' && (
          <div className="overflow-x-auto">
            <div className="min-w-max space-y-1 font-mono text-xs sm:text-sm">
              <Typography variant="bodySm" className="whitespace-nowrap">
                1. LDF = Supplier Price ÷ (1 - {currentValues.cc_margin_percent ?? 2.5}%)
              </Typography>
              <Typography variant="bodySm" className="whitespace-nowrap">
                2. Import Duty = LDF × {currentValues.import_duty_percent ?? 20}%
              </Typography>
              <Typography variant="bodySm" className="whitespace-nowrap">
                3. Transfer = LDF × {currentValues.transfer_cost_percent ?? 0.75}%
              </Typography>
              <Typography variant="bodySm" className="whitespace-nowrap">
                4. Duty Paid = LDF + Duty + Transfer
              </Typography>
              <Typography variant="bodySm" className="whitespace-nowrap">
                5. After Dist = Duty Paid ÷ (1 - {currentValues.distributor_margin_percent ?? 7.5}%)
              </Typography>
              <Typography variant="bodySm" className="whitespace-nowrap">
                6. Final = After Dist + ({currentValues.vat_percent ?? 5}% VAT)
              </Typography>
            </div>
          </div>
        )}
        {activeTab === 'pocket_cellar' && (
          <div className="overflow-x-auto">
            <div className="min-w-max space-y-1 font-mono text-xs sm:text-sm">
              <Typography variant="bodySm" className="whitespace-nowrap">
                1. After C&C = Supplier Price ÷ (1 - {currentValues.cc_margin_percent ?? 5}%)
              </Typography>
              <Typography variant="bodySm" className="whitespace-nowrap">
                2. LDF = After C&C + Logistics (${currentValues.logistics_air_per_bottle ?? 20} air / ${currentValues.logistics_ocean_per_bottle ?? 5} ocean)
              </Typography>
              <Typography variant="bodySm" className="whitespace-nowrap">
                3. Import Duty = LDF × {currentValues.import_duty_percent ?? 20}%
              </Typography>
              <Typography variant="bodySm" className="whitespace-nowrap">
                4. Transfer = LDF × {currentValues.transfer_cost_percent ?? 0.75}%
              </Typography>
              <Typography variant="bodySm" className="whitespace-nowrap">
                5. Duty Paid = LDF + Duty + Transfer
              </Typography>
              <Typography variant="bodySm" className="whitespace-nowrap">
                6. After Dist = Duty Paid ÷ (1 - {currentValues.distributor_margin_percent ?? 7.5}%)
              </Typography>
              <Typography variant="bodySm" className="whitespace-nowrap">
                7. Pre-VAT = After Dist × (1 + {currentValues.sales_commission_percent ?? 2}%)
              </Typography>
              <Typography variant="bodySm" className="whitespace-nowrap">
                8. Final = Pre-VAT + ({currentValues.vat_percent ?? 5}% VAT)
              </Typography>
            </div>
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

      {/* Partner Bespoke Pricing Table (PCO tab only) */}
      {activeTab === 'pco' && (
        <>
          <Divider />
          <PartnerBespokePricingTable />
        </>
      )}

      <Divider />

      {/* Save Button */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Typography variant="bodyXs" colorRole="muted">
          {hasChanges ? 'You have unsaved changes' : 'All changes saved'}
        </Typography>
        <Button
          variant="default"
          colorRole="brand"
          onClick={handleSave}
          isDisabled={isUpdating || !hasChanges}
          className="w-full sm:w-auto"
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
