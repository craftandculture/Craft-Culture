'use client';

import { useEffect, useState } from 'react';

import Input from '@/app/_ui/components/Input/Input';
import Select from '@/app/_ui/components/Select/Select';
import SelectContent from '@/app/_ui/components/Select/SelectContent';
import SelectItem from '@/app/_ui/components/Select/SelectItem';
import SelectTrigger from '@/app/_ui/components/Select/SelectTrigger';
import SelectValue from '@/app/_ui/components/Select/SelectValue';
import Typography from '@/app/_ui/components/Typography/Typography';

import {
  type CalculationVariables,
  defaultCalculationVariables,
} from '../schemas/calculationVariablesSchema';

interface VariablesPanelProps {
  variables: Partial<CalculationVariables> | null;
  onChange: (variables: CalculationVariables) => void;
  isUpdating?: boolean;
}

/**
 * Configuration panel for pricing calculation variables
 *
 * Includes currency rates, margin settings, freight costs, and D2C parameters
 */
const VariablesPanel = ({ variables, onChange, isUpdating }: VariablesPanelProps) => {
  // Merge with defaults to ensure all fields have values
  const [localVariables, setLocalVariables] = useState<CalculationVariables>({
    ...defaultCalculationVariables,
    ...variables,
  });

  // Sync with external changes
  useEffect(() => {
    if (variables) {
      setLocalVariables({ ...defaultCalculationVariables, ...variables });
    }
  }, [variables]);

  const handleChange = <K extends keyof CalculationVariables>(
    field: K,
    value: CalculationVariables[K],
  ) => {
    const updated = { ...localVariables, [field]: value };
    setLocalVariables(updated);
  };

  const handleBlur = () => {
    onChange(localVariables);
  };

  const handleSelectChange = <K extends keyof CalculationVariables>(
    field: K,
    value: CalculationVariables[K],
  ) => {
    const updated = { ...localVariables, [field]: value };
    setLocalVariables(updated);
    onChange(updated);
  };

  const labelClasses = 'text-xs font-medium text-text-muted';

  return (
    <div className="space-y-2">
      {/* Currency & Exchange Rates */}
      <div className="rounded-lg border border-border-muted/50 p-2">
        <Typography variant="bodyXs" colorRole="muted" className="mb-2 uppercase tracking-wide">
          Currency & Exchange Rates
        </Typography>
        <div className="space-y-2">
          <div>
            <label htmlFor="inputCurrency" className={labelClasses}>
              Input Currency
            </label>
            <Select
              value={localVariables.inputCurrency}
              onValueChange={(v) =>
                handleSelectChange('inputCurrency', v as CalculationVariables['inputCurrency'])
              }
              disabled={isUpdating}
            >
              <SelectTrigger id="inputCurrency" className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GBP">GBP</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Only show relevant conversion rate based on input currency */}
          {localVariables.inputCurrency === 'GBP' && (
            <div>
              <label htmlFor="gbpToUsdRate" className={labelClasses}>
                GBP → USD
              </label>
              <Input
                id="gbpToUsdRate"
                type="number"
                step="0.01"
                value={localVariables.gbpToUsdRate}
                onChange={(e) => handleChange('gbpToUsdRate', parseFloat(e.target.value) || 0)}
                onBlur={handleBlur}
                disabled={isUpdating}
                className="h-8"
              />
            </div>
          )}
          {localVariables.inputCurrency === 'EUR' && (
            <div>
              <label htmlFor="eurToUsdRate" className={labelClasses}>
                EUR → USD
              </label>
              <Input
                id="eurToUsdRate"
                type="number"
                step="0.01"
                value={localVariables.eurToUsdRate}
                onChange={(e) => handleChange('eurToUsdRate', parseFloat(e.target.value) || 0)}
                onBlur={handleBlur}
                disabled={isUpdating}
                className="h-8"
              />
            </div>
          )}
          {localVariables.inputCurrency === 'USD' && (
            <Typography variant="bodyXs" colorRole="muted" className="italic">
              No conversion needed (input is USD)
            </Typography>
          )}
          <div>
            <label htmlFor="defaultCaseConfig" className={labelClasses}>
              Default Case Config
            </label>
            <Select
              value={String(localVariables.defaultCaseConfig ?? 6)}
              onValueChange={(v) => handleSelectChange('defaultCaseConfig', parseInt(v, 10))}
              disabled={isUpdating}
            >
              <SelectTrigger id="defaultCaseConfig" className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="6">6</SelectItem>
                <SelectItem value="12">12</SelectItem>
                <SelectItem value="24">24</SelectItem>
              </SelectContent>
            </Select>
            <Typography variant="bodyXs" colorRole="muted" className="mt-1 italic">
              Used when no case column mapped
            </Typography>
          </div>
          <div>
            <label htmlFor="usdToAedRate" className={labelClasses}>
              USD → AED
            </label>
            <Input
              id="usdToAedRate"
              type="number"
              step="0.01"
              value={localVariables.usdToAedRate}
              onChange={(e) => handleChange('usdToAedRate', parseFloat(e.target.value) || 0)}
              onBlur={handleBlur}
              disabled={isUpdating}
              className="h-8"
            />
          </div>
        </div>
      </div>

      {/* Margin Settings */}
      <div className="rounded-lg border border-border-muted/50 p-2">
        <Typography variant="bodyXs" colorRole="muted" className="mb-2 uppercase tracking-wide">
          C&C Margin
        </Typography>
        <div className="space-y-2">
          <div>
            <label htmlFor="marginType" className={labelClasses}>
              Margin Type
            </label>
            <Select
              value={localVariables.marginType}
              onValueChange={(v) =>
                handleSelectChange('marginType', v as CalculationVariables['marginType'])
              }
              disabled={isUpdating}
            >
              <SelectTrigger id="marginType" className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Percentage</SelectItem>
                <SelectItem value="absolute">Absolute ($)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {localVariables.marginType === 'percentage' ? (
            <div>
              <label htmlFor="marginPercent" className={labelClasses}>
                Margin % (price &divide; {(1 - localVariables.marginPercent / 100).toFixed(2)})
              </label>
              <Input
                id="marginPercent"
                type="number"
                step="0.5"
                min="0"
                max="100"
                value={localVariables.marginPercent}
                onChange={(e) => handleChange('marginPercent', parseFloat(e.target.value) || 0)}
                onBlur={handleBlur}
                disabled={isUpdating}
                className="h-8"
              />
            </div>
          ) : (
            <div>
              <label htmlFor="marginAbsolute" className={labelClasses}>
                Margin ($ per case)
              </label>
              <Input
                id="marginAbsolute"
                type="number"
                step="100"
                min="0"
                value={localVariables.marginAbsolute}
                onChange={(e) => handleChange('marginAbsolute', parseFloat(e.target.value) || 0)}
                onBlur={handleBlur}
                disabled={isUpdating}
                className="h-8"
              />
            </div>
          )}
        </div>
      </div>

      {/* Freight */}
      <div className="rounded-lg border border-border-muted/50 p-2">
        <Typography variant="bodyXs" colorRole="muted" className="mb-2 uppercase tracking-wide">
          Freight
        </Typography>
        <div>
          <label htmlFor="freightPerBottle" className={labelClasses}>
            Per Bottle ($)
          </label>
          <Input
            id="freightPerBottle"
            type="number"
            step="0.5"
            min="0"
            value={localVariables.freightPerBottle ?? 2}
            onChange={(e) => handleChange('freightPerBottle', parseFloat(e.target.value) || 0)}
            onBlur={handleBlur}
            disabled={isUpdating}
            className="h-8"
          />
          <Typography variant="bodyXs" colorRole="muted" className="mt-1 italic">
            Applied × case config per product
          </Typography>
        </div>
      </div>

      {/* D2C Settings */}
      <div className="rounded-lg border border-border-muted/50 bg-surface-secondary/30 p-2">
        <Typography variant="bodyXs" colorRole="muted" className="mb-2 uppercase tracking-wide">
          D2C Settings
        </Typography>
        <div className="space-y-2">
          <div>
            <label htmlFor="salesAdvisorMarginPercent" className={labelClasses}>
              Sales Advisor Margin %
            </label>
            <Input
              id="salesAdvisorMarginPercent"
              type="number"
              step="0.5"
              min="0"
              max="100"
              value={localVariables.salesAdvisorMarginPercent}
              onChange={(e) =>
                handleChange('salesAdvisorMarginPercent', parseFloat(e.target.value) || 0)
              }
              onBlur={handleBlur}
              disabled={isUpdating}
              className="h-8"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="importDutyPercent" className={labelClasses}>
                Import Duty %
              </label>
              <Input
                id="importDutyPercent"
                type="number"
                step="1"
                min="0"
                max="100"
                value={localVariables.importDutyPercent}
                onChange={(e) => handleChange('importDutyPercent', parseFloat(e.target.value) || 0)}
                onBlur={handleBlur}
                disabled={isUpdating}
                className="h-8"
              />
            </div>
            <div>
              <label htmlFor="localCosts" className={labelClasses}>
                Local Costs ($)
              </label>
              <Input
                id="localCosts"
                type="number"
                step="1"
                min="0"
                value={localVariables.localCosts}
                onChange={(e) => handleChange('localCosts', parseFloat(e.target.value) || 0)}
                onBlur={handleBlur}
                disabled={isUpdating}
                className="h-8"
              />
            </div>
          </div>
          <div>
            <label htmlFor="vatPercent" className={labelClasses}>
              VAT %
            </label>
            <Input
              id="vatPercent"
              type="number"
              step="0.5"
              min="0"
              max="100"
              value={localVariables.vatPercent}
              onChange={(e) => handleChange('vatPercent', parseFloat(e.target.value) || 0)}
              onBlur={handleBlur}
              disabled={isUpdating}
              className="h-8"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default VariablesPanel;
